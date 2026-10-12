import * as SecureStore from 'expo-secure-store';

const KEY_URL = 'oc.baseUrl';
const KEY_URLS = 'oc.baseUrls';
const KEY_TOKEN = 'oc.token';

export type Session = {
  id: string;
  projectID?: string;
  agent?: string;
  title?: string;
  model?: { id?: string; providerID?: string };
  time?: { created?: number; updated?: number };
};

type Creds = { baseUrl: string; token: string; urls: string[] };

let cache: Creds | null = null;

/** Quita barras finales y duplicados de una lista de direcciones. */
function normalizeUrls(list: unknown[]): string[] {
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string' || !item.trim()) continue;
    const v = item.trim().replace(/\/+$/, '');
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// base64 sencillo (solo ASCII) — no usamos btoa porque RN no lo trae siempre
function b64(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i += 3) {
    const c1 = input.charCodeAt(i);
    const c2 = input.charCodeAt(i + 1);
    const c3 = input.charCodeAt(i + 2);
    out += B64[c1 >> 2];
    out += B64[((c1 & 3) << 4) | (isNaN(c2) ? 0 : c2 >> 4)];
    out += isNaN(c2) ? '=' : B64[((c2 & 15) << 2) | (isNaN(c3) ? 0 : c3 >> 6)];
    out += isNaN(c3) ? '=' : B64[c3 & 63];
  }
  return out;
}

export async function loadCreds(): Promise<Creds | null> {
  if (cache) return cache;
  const baseUrl = await SecureStore.getItemAsync(KEY_URL);
  const token = await SecureStore.getItemAsync(KEY_TOKEN);
  if (!baseUrl || !token) return null;
  const rawUrls = await SecureStore.getItemAsync(KEY_URLS);
  let urls: string[] = [];
  if (rawUrls) {
    try {
      urls = normalizeUrls(JSON.parse(rawUrls));
    } catch {
      urls = [];
    }
  }
  cache = {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    token,
    urls: normalizeUrls([baseUrl, ...urls]),
  };
  return cache;
}

export async function saveCreds(baseUrl: string, token: string) {
  const base = baseUrl.replace(/\/+$/, '');
  const urls = normalizeUrls([base, ...(cache?.urls ?? [])]);
  cache = { baseUrl: base, token, urls };
  await SecureStore.setItemAsync(KEY_URL, base);
  await SecureStore.setItemAsync(KEY_TOKEN, token);
  await SecureStore.setItemAsync(KEY_URLS, JSON.stringify(urls));
}

export async function clearCreds() {
  cache = null;
  await SecureStore.deleteItemAsync(KEY_URL);
  await SecureStore.deleteItemAsync(KEY_URLS);
  await SecureStore.deleteItemAsync(KEY_TOKEN);
}

export function authHeader(token: string) {
  return 'Basic ' + b64('opencode:' + token);
}

/** Direcciones conocidas, la activa primero. */
export async function getKnownUrls(): Promise<string[]> {
  const creds = await loadCreds();
  return creds ? normalizeUrls([creds.baseUrl, ...creds.urls]) : [];
}

/** Añade direcciones nuevas a la lista (p. ej. las que reporta `/api/info`). */
export async function rememberUrls(list: string[]) {
  const creds = await loadCreds();
  if (!creds || list.length === 0) return;
  const urls = normalizeUrls([creds.baseUrl, ...creds.urls, ...list]);
  const same =
    urls.length === creds.urls.length && urls.every((u, i) => u === creds.urls[i]);
  if (same) return;
  cache = { ...creds, urls };
  await SecureStore.setItemAsync(KEY_URLS, JSON.stringify(urls));
}

/** Deja una dirección como activa (la primera que se probará). */
export async function activateUrl(url: string) {
  const creds = await loadCreds();
  if (!creds) return;
  const base = url.trim().replace(/\/+$/, '');
  if (base === creds.baseUrl) return;
  const urls = normalizeUrls([base, ...creds.urls]);
  cache = { baseUrl: base, token: creds.token, urls };
  await SecureStore.setItemAsync(KEY_URL, base);
  await SecureStore.setItemAsync(KEY_URLS, JSON.stringify(urls));
}

type ReqInit = { method?: string; headers?: Record<string, string>; body?: string };

class HttpError extends Error {
  status: number;
  constructor(status: number, body: string) {
    super(`HTTP ${status}: ${body.slice(0, 180)}`);
    this.status = status;
  }
}

/**
 * Petición a la API probando todas las direcciones conocidas.
 * Si la primera falla a nivel de red, pasa a la siguiente, y la que responde
 * se queda como dirección activa. Un error HTTP (401, 404…) NO prueba otra
 * dirección: significa que el host es el correcto.
 */
async function request(path: string, init?: ReqInit): Promise<string> {
  const creds = await loadCreds();
  if (!creds) throw new Error('Sin conexión configurada');
  const order = normalizeUrls([creds.baseUrl, ...creds.urls]);
  const withTimeout = order.length > 1;
  let lastErr: unknown = null;

  for (const base of order) {
    const ctrl = withTimeout ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 6000) : null;
    try {
      const res = await fetch(base + path, {
        method: init?.method,
        headers: { Authorization: authHeader(creds.token), ...(init?.headers ?? {}) },
        body: init?.body,
        signal: ctrl ? ctrl.signal : undefined,
      });
      const text = await res.text();
      if (!res.ok) throw new HttpError(res.status, text);
      if (base !== creds.baseUrl) await activateUrl(base);
      return text;
    } catch (e) {
      lastErr = e;
      if (e instanceof HttpError) throw e;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('No se pudo conectar con el servidor');
}

export async function apiGet<T>(path: string): Promise<T> {
  return JSON.parse(await request(path)) as T;
}

/**
 * ¿Responde el servidor y estamos autenticados? De paso aprende sus
 * direcciones actuales desde `/api/info`, para sobrevivir a los cambios de IP.
 */
export async function ping(): Promise<boolean> {
  try {
    const info = JSON.parse(await request('/api/info')) as { urls?: string[] };
    if (Array.isArray(info.urls)) await rememberUrls(info.urls);
    return true;
  } catch {
    return false;
  }
}

/** Del enlace de emparejamiento saca la URL base, o null si no es un enlace. */
export function baseUrlFromLink(link: string): string | null {
  const m = link.trim().match(/^(https?:\/\/[^/]+)\/auth\/connect\//);
  return m ? m[1] : null;
}

/** Canjea un enlace de emparejamiento y devuelve el token. */
export async function redeem(link: string): Promise<string> {
  const res = await fetch(link.trim());
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 180)}`);
  const json = JSON.parse(text) as { token?: string };
  if (!json.token) throw new Error('El enlace no devolvió token');
  return json.token;
}

// ---------- mensajes ----------

export type Part = {
  type: string; // 'text' | 'reasoning' | 'tool' | ...
  text?: string;
  name?: string;
  id?: string;
  state?: { status?: string; input?: Record<string, unknown>; output?: unknown };
};

export type Msg = {
  id: string;
  type: string; // 'user' | 'assistant' | 'idle' | ...
  text?: string;
  content?: Part[];
  agent?: string;
  model?: { id?: string; providerID?: string; variant?: string };
  finish?: string;
  time?: { created?: number };
};

export type MsgCursor = { previous: string | null; next: string | null };

export type MessagesPage = { data: Msg[]; cursor: MsgCursor };

/** Un adjunto del prompt: la `uri` puede ser `data:<mime>;base64,…`. */
export type Attachment = { uri: string; name?: string; description?: string };

/**
 * Mensajes de una sesión, paginados.
 * - Primera página: `order: 'desc'` (los más nuevos primero).
 * - Para traer más antiguos: el `cursor.next` de la página anterior.
 */
export async function getMessages(
  sessionId: string,
  opts?: { limit?: number; cursor?: string | null; order?: 'asc' | 'desc' }
): Promise<MessagesPage> {
  const parts = [`limit=${opts?.limit ?? 40}`];
  if (opts?.cursor) parts.push(`cursor=${encodeURIComponent(opts.cursor)}`);
  else if (opts?.order) parts.push(`order=${opts.order}`);
  const res = await apiGet<{ data: Msg[]; cursor?: MsgCursor }>(
    `/api/session/${sessionId}/message?${parts.join('&')}`
  );
  return { data: res.data ?? [], cursor: res.cursor ?? { previous: null, next: null } };
}

export async function sendPrompt(sessionId: string, text: string, files?: Attachment[]) {
  return request(`/api/session/${sessionId}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(files && files.length > 0 ? { text, files } : { text }),
  });
}

export async function interruptSession(sessionId: string) {
  return request(`/api/session/${sessionId}/interrupt`, { method: 'POST' });
}

// ---------- diff ----------

export type FileDiff = {
  file: string;
  patch: string;
  additions: number;
  deletions: number;
  status: 'added' | 'deleted' | 'modified' | string;
};

export async function getSessionDiff(sessionId: string): Promise<FileDiff[]> {
  const res = await apiGet<{ data: FileDiff[] }>(`/api/session/${sessionId}/diff`);
  return res.data ?? [];
}

// ---------- acciones de sesión ----------

async function sessionAction(sessionId: string, path: string, method: string, body?: unknown) {
  return request(`/api/session/${sessionId}${path}`, {
    method,
    ...(body !== undefined
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  });
}

export function renameSession(sessionId: string, title: string) {
  return sessionAction(sessionId, '', 'PATCH', { title });
}

export async function forkSession(sessionId: string): Promise<{ id: string } | null> {
  const text = await request(`/api/session/${sessionId}/fork`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const json = JSON.parse(text) as { data?: { id: string } } | { id: string };
  return ('data' in json && json.data ? json.data : (json as { id: string })) ?? null;
}

export function deleteSession(sessionId: string) {
  return sessionAction(sessionId, '', 'DELETE');
}

export function compactSession(sessionId: string) {
  return sessionAction(sessionId, '/compact', 'POST', {});
}

// ---------- modelos ----------

export type Model = {
  id: string;
  providerID: string;
  name?: string;
  variants?: { id: string }[];
  limit?: { context?: number; output?: number };
  cost?: { input?: number; output?: number }[];
  status?: string;
  enabled?: boolean;
};

export async function getModels(): Promise<Model[]> {
  const res = await apiGet<{ data: Model[] } | Model[]>('/api/model');
  return Array.isArray(res) ? res : (res.data ?? []);
}

export async function setSessionModel(
  sessionId: string,
  model: { id: string; providerID: string; variant?: string }
) {
  return request(`/api/session/${sessionId}/model`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  });
}

// ---------- agentes ----------

export type AgentInfo = { name: string; description?: string };

export async function getAgents(): Promise<AgentInfo[]> {
  const res = await apiGet<{ data: AgentInfo[] } | AgentInfo[]>('/api/agent');
  return Array.isArray(res) ? res : (res.data ?? []);
}

// El streaming (SSE) vive en `@/lib/events`: una sola conexión compartida
// que además informa del estado de conexión.

// ---------- permisos ----------

export type PermissionRequest = {
  id: string;
  sessionID: string;
  action: string;
  resources?: string[];
  message?: string;
};

export async function getPermissions(sessionId: string): Promise<PermissionRequest[]> {
  const res = await apiGet<{ data: PermissionRequest[] }>(`/api/session/${sessionId}/permission`);
  return res.data ?? [];
}

export async function replyPermission(
  sessionId: string,
  requestId: string,
  decision: 'once' | 'always' | 'reject'
) {
  return request(`/api/session/${sessionId}/permission/${requestId}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
}

// ---------- gestión del servidor (OpenCode) ----------

export type Provider = {
  id: string;
  integrationID?: string;
  name?: string;
  /** 'auto' | 'enabled' | … */
  activation?: string;
  package?: string;
  settings?: Record<string, unknown>;
};

export type Credential = {
  id: string;
  integrationID: string;
  label?: string;
  active?: boolean;
  value?: { type?: string; key?: string };
};

export type PluginSource = {
  /** 'builtin' | 'package' | 'local' | 'sdk' */
  type?: string;
  target?: string;
  version?: string;
  path?: string;
  outdated?: boolean;
  updating?: boolean;
};

export type PluginInfo = {
  id: string;
  source?: PluginSource;
  features?: Record<string, boolean>;
  state?: { status?: string; error?: string };
};

export type SavedPermission = {
  id: string;
  projectID?: string;
  action: string;
  resource: string;
  time?: { created?: number; updated?: number };
};

export async function getProviders(): Promise<Provider[]> {
  const res = await apiGet<{ data: Provider[] } | Provider[]>('/api/provider');
  return Array.isArray(res) ? res : (res.data ?? []);
}

export async function getCredentials(): Promise<Credential[]> {
  const res = await apiGet<{ data: Credential[] }>('/api/credential');
  return res.data ?? [];
}

export async function getPlugins(): Promise<PluginInfo[]> {
  const res = await apiGet<{ data: PluginInfo[] } | PluginInfo[]>('/api/plugin');
  return Array.isArray(res) ? res : (res.data ?? []);
}

async function pluginAction(path: string): Promise<PluginInfo[]> {
  const text = await request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  return (JSON.parse(text) as { data?: PluginInfo[] }).data ?? [];
}

/** Busca actualizaciones (marca `source.outdated` en los plugins). */
export function checkPluginUpdates() {
  return pluginAction('/api/plugin/check');
}

/** Actualiza los plugins que estén desactualizados. */
export function updatePlugins() {
  return pluginAction('/api/plugin/update');
}

export async function getSavedPermissions(): Promise<SavedPermission[]> {
  const res = await apiGet<{ data: SavedPermission[] }>('/api/permission/saved');
  return res.data ?? [];
}

export function removeSavedPermission(id: string) {
  return request(`/api/permission/saved/${id}`, { method: 'DELETE' });
}

/** Descripción corta del origen de un plugin. */
export function pluginWhere(p: PluginInfo): string {
  const s = p.source ?? {};
  if (s.type === 'package') return `${s.target ?? ''}${s.version ? ` v${s.version}` : ''}`;
  if (s.type === 'local') return s.path ?? 'local';
  return s.type ?? '';
}

/** Máscara de una clave: deja ver solo los últimos 4 caracteres. */
export function maskKey(key?: string): string {
  if (!key) return '••••';
  return key.length <= 4 ? '••••' : '••••' + key.slice(-4);
}

// ---------- formularios (questions) ----------

export type FormOption = { value: string; label: string; description?: string };

export type FormFieldType = 'string' | 'number' | 'integer' | 'boolean' | 'multiselect' | 'external';

export type FormField = {
  key: string;
  type: FormFieldType;
  title?: string;
  description?: string;
  required?: boolean;
  hidden?: boolean;
  when?: { key: string; op: 'eq' | 'neq'; value: string | number | boolean }[];
  placeholder?: string;
  format?: 'email' | 'uri' | 'date' | 'date-time';
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
  options?: FormOption[];
  custom?: boolean;
  default?: string | number | boolean | string[];
  url?: string;
};

/** Un formulario pendiente (la `question` del agente). */
export type FormInfo = {
  id: string;
  sessionID: string;
  title: string;
  metadata?: Record<string, unknown>;
  fields: FormField[];
};

/** Respuesta: `clave -> valor`, donde el valor es texto, número, booleano o lista de textos. */
export type FormAnswer = Record<string, string | number | boolean | string[]>;

export async function getForms(sessionId: string): Promise<FormInfo[]> {
  const res = await apiGet<{ data: FormInfo[] }>(`/api/session/${sessionId}/form`);
  return res.data ?? [];
}

export function replyForm(sessionId: string, formId: string, answer: FormAnswer) {
  return sessionAction(sessionId, `/form/${formId}/reply`, 'POST', { answer });
}

export function cancelForm(sessionId: string, formId: string, message?: string) {
  const q = message ? `?message=${encodeURIComponent(message)}` : '';
  return sessionAction(sessionId, `/form/${formId}${q}`, 'DELETE');
}

// ---------- proyectos y sesiones ----------

export type Project = { id: string; canonical: string };

/** Valores por defecto para las sesiones nuevas (luego serán configurables en Ajustes). */
export const DEFAULT_AGENT = 'build';
export const DEFAULT_MODEL = { id: 'deepseek-flash', providerID: 'deepseek' };

export async function getProjects(): Promise<Project[]> {
  const res = await apiGet<Project[] | { data: Project[] }>('/api/project');
  return Array.isArray(res) ? res : (res.data ?? []);
}

export async function getSessions(): Promise<Session[]> {
  const res = await apiGet<{ data: Session[] }>('/api/session');
  return res.data ?? [];
}

export async function createSession(
  directory: string,
  opts?: { agent?: string; model?: { id: string; providerID: string } }
): Promise<{ id: string }> {
  const body = {
    location: { directory },
    agent: opts?.agent ?? DEFAULT_AGENT,
    model: opts?.model ?? DEFAULT_MODEL,
  };
  const text = await request('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = JSON.parse(text) as { data?: { id: string } } | { id: string };
  return ('data' in json && json.data ? json.data : (json as { id: string })) as { id: string };
}

/** Nombre corto de una ruta: la última carpeta. */
export function shortPath(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? p;
}
