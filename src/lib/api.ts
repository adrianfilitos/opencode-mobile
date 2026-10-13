import * as SecureStore from 'expo-secure-store';

const KEY_URL = 'oc.baseUrl';
const KEY_URLS = 'oc.baseUrls';
const KEY_TOKEN = 'oc.token';

export type TokenUsage = {
  input?: number;
  output?: number;
  reasoning?: number;
  cache?: { read?: number; write?: number };
};

export type Session = {
  id: string;
  projectID?: string;
  agent?: string;
  title?: string;
  model?: { id?: string; providerID?: string; variant?: string };
  cost?: number;
  tokens?: TokenUsage;
  /** Revert preparado (si hay uno a medias). */
  revert?: { messageID?: string; partID?: string; snapshot?: string; files?: FileDiff[] };
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

/** Una petición a UNA dirección concreta, con corte por tiempo. */
async function fetchOne(
  base: string,
  path: string,
  init: ReqInit | undefined,
  token: string,
  ms: number
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(base + path, {
      method: init?.method,
      headers: { Authorization: authHeader(token), ...(init?.headers ?? {}) },
      body: init?.body,
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new HttpError(res.status, text);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Busca EN PARALELO la primera dirección que responde de verdad.
 * Es lo que hace que un cambio de IP no te deje tirado: aunque la dirección
 * guardada esté muerta, en cuanto una de las conocidas contesta, seguimos.
 */
async function findWorking(order: string[], token: string): Promise<string | null> {
  return new Promise((resolve) => {
    let left = order.length;
    let done = false;
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    if (left === 0) {
      finish(null);
      return;
    }
    for (const base of order) {
      fetchOne(base, '/api/info', undefined, token, 4000)
        .then(() => finish(base))
        .catch(() => {
          if (--left === 0) finish(null);
        });
    }
  });
}

/**
 * Petición a la API. Usa la dirección activa y, si no responde a nivel de red,
 * prueba EN PARALELO el resto de direcciones conocidas (IP local nueva,
 * Tailscale, nombre .local…) y reintenta con la que funcione.
 *
 * Un error HTTP (401, 404…) NO prueba otra dirección: significa que el host es
 * el correcto y el problema es otro, así que se devuelve tal cual.
 */
async function request(path: string, init?: ReqInit): Promise<string> {
  const creds = await loadCreds();
  if (!creds) throw new Error('Sin conexión configurada');
  const order = normalizeUrls([creds.baseUrl, ...creds.urls]);

  let lastErr: unknown = null;
  try {
    return await fetchOne(order[0], path, init, creds.token, 4000);
  } catch (e) {
    if (e instanceof HttpError) throw e;
    lastErr = e;
  }

  // La dirección activa no contesta: buscamos otra que sí.
  const good = await findWorking(order, creds.token);
  if (!good) {
    throw lastErr instanceof Error ? lastErr : new Error('No se pudo conectar con el servidor');
  }
  if (good !== order[0]) await activateUrl(good);
  return fetchOne(good, path, init, creds.token, 8000);
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

/**
 * El PC mete en el enlace direcciones «estables» (nombre .local, Tailscale)
 * detrás de un `#u=`. Aquí se leen para guardarlas: así, cuando cambie la IP
 * del PC, la app ya sabe a dónde llamar sin volver a emparejar.
 */
export function extraUrlsFromLink(link: string): string[] {
  const m = link.match(/#u=([^#\s]+)/);
  if (!m) return [];
  const raw = (() => {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  })();
  return normalizeUrls(raw.split(','));
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

export type ToolContent = {
  /** 'text' | 'file' */
  type: string;
  text?: string;
  /** Para `type: 'file'`: file:///C:/… o C:/… */
  uri?: string;
  mime?: string;
  name?: string | null;
};

export type Part = {
  type: string; // 'text' | 'reasoning' | 'tool' | ...
  text?: string;
  name?: string;
  id?: string;
  executed?: boolean;
  state?: {
    status?: string;
    title?: string;
    input?: Record<string, unknown>;
    /** Salida de la herramienta (normalmente texto). */
    content?: ToolContent[];
    metadata?: Record<string, unknown>;
    output?: unknown;
  };
  time?: { created?: number; ran?: number; completed?: number };
};

export type Msg = {
  id: string;
  type: string; // 'user' | 'assistant' | 'idle' | ...
  text?: string;
  content?: Part[];
  agent?: string;
  model?: { id?: string; providerID?: string; variant?: string };
  finish?: string;
  cost?: number;
  tokens?: TokenUsage;
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

export async function sendPrompt(
  sessionId: string,
  text: string,
  files?: Attachment[],
  opts?: { skills?: SkillAttachment[]; delivery?: 'steer' | 'queue' }
) {
  const body: Record<string, unknown> = { text };
  if (files && files.length > 0) body.files = files;
  if (opts?.skills && opts.skills.length > 0) body.skills = opts.skills;
  if (opts?.delivery) body.delivery = opts.delivery;
  return request(`/api/session/${sessionId}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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

export type AgentInfo = {
  id?: string;
  name: string;
  description?: string;
  /** 'primary' | 'subagent' | … */
  mode?: string;
  hidden?: boolean;
  permissions?: AgentPermission[];
};

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

// ---------- ficheros del PC (para el módulo Revisión) ----------

/** `file:///C:/x` · `file://C:/x` · `C:/x` → `C:/x` */
export function filePath(uri: string): string {
  let p = uri.replace(/^file:\/\//i, '');
  if (/^\/[A-Za-z]:\//.test(p)) p = p.slice(1);
  return p;
}

/** Base y cabeceras para pedir ficheros (imágenes) al servidor. */
export async function fileAccess(): Promise<{
  base: string;
  headers: Record<string, string>;
} | null> {
  const creds = await loadCreds();
  if (!creds) return null;
  return { base: creds.baseUrl, headers: { Authorization: authHeader(creds.token) } };
}

/** URL absoluta (con auth aparte) para un fichero del PC. */
export function fileUrl(base: string, path: string): string {
  return `${base}/api/fs/read/${path}`;
}

/** Lee un fichero del PC como texto. */
export function readFileText(path: string): Promise<string> {
  return request(`/api/fs/read/${path}`);
}

/**
 * Carpeta donde el agente deja lo que quiere enseñarte (panel «Revisión»).
 * Es la forma de que algo llegue al móvil: el escritorio tiene su propio panel.
 */
export const REVIEW_DIR = 'C:/Users/nixer/.opencode/review';

export type DirEntry = { name: string; path: string; type: string };

/** Lista una carpeta del PC (rutas absolutas). */
export async function listDir(dir: string): Promise<FsEntry[]> {
  const base = dir.replace(/\/+$/, '');
  const res = await apiGet<{ data: { path: string; type: string }[] }>(
    `/api/fs/list?path=${base.replace(/ /g, '%20')}`
  );
  return (res.data ?? []).map((e) => {
    const name = e.path.split(/[\\/]/).filter(Boolean).pop() ?? e.path;
    const abs = `${base}/${name}`;
    return { name, path: e.path, abs, type: e.type };
  });
}

/** Un fichero que el agente ha "enseñado" (salida de una herramienta). */
export type ShownFile = {
  path: string;
  uri: string;
  mime: string;
  name?: string;
  tool?: string;
};

/** Recoge los ficheros mostrados por las herramientas de una sesión. */
export function collectShownFiles(msgs: Msg[]): ShownFile[] {
  const out: ShownFile[] = [];
  const seen = new Set<string>();
  for (const m of msgs) {
    for (const p of m.content ?? []) {
      if (p.type !== 'tool') continue;
      for (const c of p.state?.content ?? []) {
        if (c.type !== 'file' || !c.uri) continue;
        const path = filePath(c.uri);
        if (seen.has(path)) continue;
        seen.add(path);
        out.push({
          path,
          uri: c.uri,
          mime: c.mime ?? '',
          name: c.name ?? undefined,
          tool: p.name,
        });
      }
    }
  }
  return out;
}

// ---------- gestión del servidor: agentes, MCP, integraciones, etc. ----------

export type AgentPermission = { action: string; resource: string; effect: string };

export type SkillInfo = {
  id: string;
  name?: string;
  description?: string;
  path?: string;
  content?: string;
};

export type CommandInfo = { name: string; description?: string };

export type McpServer = {
  name: string;
  status?: { status?: string; error?: string };
  integrationID?: string;
};

export type IntegrationMethod = { type?: string; names?: string[] };

export type IntegrationConnection = {
  id?: string;
  label?: string;
  methodID?: string;
  type?: string;
  createdAt?: number;
};

export type Integration = {
  id: string;
  name: string;
  methods?: IntegrationMethod[];
  connections?: IntegrationConnection[];
};

export type WebSearchProvider = { id: string; name?: string };

export type ConfigSource = { type?: string; path?: string };

export type DefaultModel = {
  id?: string;
  modelID?: string;
  providerID?: string;
  name?: string;
  status?: string;
  limit?: { context?: number; output?: number };
  capabilities?: { tools?: boolean; input?: string[]; output?: string[] };
  variants?: { id: string }[];
  cost?: { input?: number; output?: number }[];
};

export type Pairing = { code: string; expires_in: number };

export async function getSkills(): Promise<SkillInfo[]> {
  const res = await apiGet<{ data: SkillInfo[] } | SkillInfo[]>('/api/skill');
  return Array.isArray(res) ? res : (res.data ?? []);
}

export async function getCommands(): Promise<CommandInfo[]> {
  const res = await apiGet<{ data: CommandInfo[] } | CommandInfo[]>('/api/command');
  return Array.isArray(res) ? res : (res.data ?? []);
}

export async function getMcpServers(): Promise<McpServer[]> {
  const res = await apiGet<{ data: McpServer[] } | McpServer[]>('/api/mcp');
  return Array.isArray(res) ? res : (res.data ?? []);
}

export function connectMcp(name: string) {
  return request(`/api/experimental/mcp/${encodeURIComponent(name)}/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
}

export function disconnectMcp(name: string) {
  return request(`/api/experimental/mcp/${encodeURIComponent(name)}/disconnect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
}

export function removeMcp(name: string) {
  return request(`/api/experimental/mcp/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

export async function getIntegrations(): Promise<Integration[]> {
  const res = await apiGet<{ data: Integration[] } | Integration[]>('/api/integration');
  return Array.isArray(res) ? res : (res.data ?? []);
}

export function connectIntegrationKey(id: string, key: string, label?: string) {
  return request(`/api/integration/${encodeURIComponent(id)}/connect/key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(label ? { key, label } : { key }),
  });
}

export async function getWebSearchProviders(): Promise<WebSearchProvider[]> {
  const res = await apiGet<{ data: WebSearchProvider[] } | WebSearchProvider[]>('/api/websearch/provider');
  return Array.isArray(res) ? res : (res.data ?? []);
}

export async function getConfigSources(): Promise<ConfigSource[]> {
  const res = await apiGet<ConfigSource[] | { data: ConfigSource[] }>('/api/config');
  return Array.isArray(res) ? res : (res.data ?? []);
}

/** Modelo por defecto del servidor (el que usa cuando no se especifica otro). */
export async function getDefaultModel(): Promise<DefaultModel | null> {
  const res = await apiGet<{ data: DefaultModel } | DefaultModel>('/api/model/default');
  return 'data' in (res as object) ? ((res as { data: DefaultModel }).data ?? null) : (res as DefaultModel);
}

/** Crea un código de emparejamiento de un solo uso (caduca en `expires_in` s). */
export async function createPairing(): Promise<Pairing> {
  const text = await request('/api/pair', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const json = JSON.parse(text) as Pairing | { data: Pairing };
  return 'data' in json && json.data ? json.data : (json as Pairing);
}

// ---------- uso, coste y estadísticas ----------
/** Tokens que ocupa el contexto en la última petición (lo que llena la ventana). */
export function contextTokens(t?: TokenUsage): number {
  if (!t) return 0;
  return (t.input ?? 0) + (t.cache?.read ?? 0) + (t.cache?.write ?? 0);
}

/** Suma de todo lo gastado (entrada + salida + razonamiento + caché). */
export function totalTokens(t?: TokenUsage): number {
  if (!t) return 0;
  return (
    (t.input ?? 0) +
    (t.output ?? 0) +
    (t.reasoning ?? 0) +
    (t.cache?.read ?? 0) +
    (t.cache?.write ?? 0)
  );
}

/** Porcentaje de contexto usado (0..100). */
export function useContext(t?: TokenUsage, limit?: number): number {
  if (!limit || limit <= 0) return 0;
  return Math.min(100, (contextTokens(t) / limit) * 100);
}

/** "0,31 US$" (sin depender de Intl, que en Hermes puede no estar). */
export function formatUSD(n?: number): string {
  return (Math.round((n ?? 0) * 100) / 100).toFixed(2).replace('.', ',') + ' US$';
}

/** "382.716" — miles con punto. */
export function formatNum(n?: number): string {
  return String(Math.round(n ?? 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** "382,7 k" / "1,23 M". */
export function formatTokens(n?: number): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2).replace('.', ',') + ' M';
  if (v >= 1_000) return (v / 1_000).toFixed(1).replace('.', ',') + ' k';
  return String(v);
}

/** Color del semáforo del contexto. */
export function usageColor(percent: number, ok: string, warn: string): string {
  if (percent > 85) return '#fca5a5';
  if (percent >= 60) return warn;
  return ok;
}

export type StatsTools = {
  mode?: string;
  totals?: { calls?: number; succeeded?: number; failed?: number; unfinished?: number };
};

export type ModelUsage = {
  model?: { id?: string; providerID?: string; variant?: string };
  steps?: number;
  tokens?: TokenUsage;
  cost?: number;
};

export type ActivityDay = { date: string; steps: number };

export type SessionStats = {
  range?: { from?: number; to?: number };
  sessions?: number;
  subagents?: number;
  prompts?: number;
  steps?: number;
  tokens?: TokenUsage;
  cost?: number;
  tools?: StatsTools;
  activeDays?: number;
  streak?: number;
  activity?: ActivityDay[];
  models?: ModelUsage[];
};

/** Estadísticas globales (gasto, tokens, pasos…) en un rango de tiempo. */
export async function getSessionStats(opts?: {
  from?: number;
  to?: number;
  project?: string;
}): Promise<SessionStats | null> {
  const parts: string[] = [];
  if (opts?.from != null) parts.push(`from=${opts.from}`);
  if (opts?.to != null) parts.push(`to=${opts.to}`);
  if (opts?.project) parts.push(`project=${encodeURIComponent(opts.project)}`);
  const q = parts.length ? `?${parts.join('&')}` : '';
  const res = await apiGet<{ data: SessionStats } | SessionStats>(
    `/api/experimental/session/stats${q}`
  );
  return 'data' in (res as object) ? ((res as { data: SessionStats }).data ?? null) : (res as SessionStats);
}

// ---------- deshacer (revert) ----------

export function stageRevert(sessionId: string, messageID: string, files = true) {
  return sessionAction(sessionId, '/revert/stage', 'POST', { messageID, files });
}

export function commitRevert(sessionId: string) {
  return sessionAction(sessionId, '/revert/commit', 'POST', {});
}

export function clearRevert(sessionId: string) {
  return sessionAction(sessionId, '/revert', 'DELETE');
}

// ---------- skill adjunta al prompt ----------

export type SkillAttachment = { id: string };

// ---------- comandos ----------

export function runCommand(
  sessionId: string,
  name: string,
  text = '',
  opts?: { files?: Attachment[]; skills?: SkillAttachment[]; delivery?: 'steer' | 'queue' }
) {
  return sessionAction(sessionId, '/command', 'POST', {
    name,
    text,
    ...(opts?.files && opts.files.length > 0 ? { files: opts.files } : {}),
    ...(opts?.skills && opts.skills.length > 0 ? { skills: opts.skills } : {}),
    ...(opts?.delivery ? { delivery: opts.delivery } : {}),
  });
}

// ---------- inbox (steering: hablar sin interrumpir) ----------

export type InboxItem = {
  id: string;
  text?: string;
  delivery?: string;
  status?: string;
  time?: { created?: number; updated?: number };
};

export async function getInbox(sessionId: string): Promise<InboxItem[]> {
  const res = await apiGet<{ data: InboxItem[] }>(`/api/session/${sessionId}/inbox`);
  return res.data ?? [];
}

export function cancelInbox(sessionId: string, inboxId: string) {
  return sessionAction(sessionId, `/inbox/${inboxId}`, 'DELETE');
}

export function setInboxDelivery(sessionId: string, inboxId: string, delivery: 'steer' | 'queue') {
  return sessionAction(sessionId, `/inbox/${inboxId}`, 'PATCH', { delivery });
}

// ---------- ubicación ----------

export type LocationInfo = {
  directory?: string;
  project?: { id?: string; directory?: string; canonical?: string };
};

export async function getLocation(): Promise<LocationInfo | null> {
  return apiGet<LocationInfo>('/api/location');
}

// ---------- ficheros: navegar y buscar ----------

export type FsEntry = { name: string; path: string; abs: string; type: string };

function toAbs(location: string, rel: string): string {
  const dir = location.replace(/\\/g, '/').replace(/\/+$/, '');
  return `${dir}/${rel.replace(/^\/+/, '')}`;
}

/** Busca ficheros por nombre en el proyecto (o en `directory`). */
export async function findFiles(
  query: string,
  opts?: { directory?: string; limit?: number }
): Promise<{ location: string; entries: FsEntry[] }> {
  const parts = [`query=${encodeURIComponent(query)}`, `limit=${opts?.limit ?? 40}`];
  if (opts?.directory) parts.push(`location[directory]=${encodeURIComponent(opts.directory)}`);
  const res = await apiGet<{
    location?: { directory?: string };
    data: { path: string; type: string }[];
  }>(`/api/fs/find?${parts.join('&')}`);
  const loc = res.location?.directory ?? '';
  const entries = (res.data ?? []).map((e) => {
    const name = e.path.split(/[\\/]/).filter(Boolean).pop() ?? e.path;
    return { name, path: e.path, abs: toAbs(loc, e.path), type: e.type };
  });
  return { location: loc, entries };
}

// ---------- git (VCS) ----------

export type VcsStatus = { path?: string; status?: string; staged?: string };
export type VcsBranch = { name?: string; current?: boolean };

function withLoc(path: string, directory?: string): string {
  return directory ? `${path}?location[directory]=${encodeURIComponent(directory)}` : path;
}

export async function getVcsStatus(directory?: string): Promise<VcsStatus[]> {
  const res = await apiGet<{ data: VcsStatus[] }>(withLoc('/api/vcs/status', directory));
  return res.data ?? [];
}

export async function getVcsBranches(directory?: string): Promise<VcsBranch[]> {
  const res = await apiGet<{ data: VcsBranch[] }>(withLoc('/api/vcs/branch', directory));
  return res.data ?? [];
}

export async function getVcsDiff(directory?: string): Promise<FileDiff[]> {
  const res = await apiGet<{ data: FileDiff[] }>(withLoc('/api/vcs/diff', directory));
  return res.data ?? [];
}

export function vcsInit(directory?: string) {
  return request(withLoc('/api/vcs/init', directory), { method: 'POST' });
}

// ---------- worktrees ----------

export type Worktree = { directory?: string; branch?: string; name?: string; projectID?: string };

export async function getWorktrees(projectID?: string): Promise<Worktree[]> {
  const q = projectID ? `?projectID=${encodeURIComponent(projectID)}` : '';
  const res = await apiGet<{ data: Worktree[] }>(`/api/worktree${q}`);
  return res.data ?? [];
}

export function refreshWorktrees(projectID: string) {
  return request('/api/worktree/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectID }),
  });
}

/** Crea un worktree (copia del proyecto en otra rama). */
export function createWorktree(
  projectID: string,
  opts?: { branch?: string; from?: string; name?: string; directory?: string }
) {
  return request('/api/worktree', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectID, ...opts }),
  });
}

export function removeWorktree(projectID: string, directory: string, force = false) {
  return request('/api/worktree', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectID, directory, force }),
  });
}

// ---------- shells ----------

export type ShellInfo = {
  id: string;
  status?: string;
  command?: string;
  cwd?: string;
  output?: string;
  /** Fichero con la salida completa (se puede leer con /api/fs/read). */
  file?: string;
  time?: { started?: number; completed?: number };
};

export async function getShells(directory?: string): Promise<ShellInfo[]> {
  const res = await apiGet<{ data: ShellInfo[] }>(withLoc('/api/shell', directory));
  return res.data ?? [];
}

export async function getShell(id: string, directory?: string): Promise<ShellInfo | null> {
  const res = await apiGet<{ data: ShellInfo }>(withLoc(`/api/shell/${id}`, directory));
  return res.data ?? null;
}

export function removeShell(id: string, directory?: string) {
  return request(withLoc(`/api/shell/${id}`, directory), { method: 'DELETE' });
}

// ---------- terminal (PTY) ----------

export type PtyInfo = { id: string; title?: string; command?: string; status?: string };

export async function getPtys(directory?: string): Promise<PtyInfo[]> {
  const res = await apiGet<{ data: PtyInfo[] }>(withLoc('/api/pty', directory));
  return res.data ?? [];
}

export function createPty(opts?: { command?: string; cwd?: string; title?: string }) {
  return request('/api/pty', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts ?? {}),
  });
}

export function removePty(id: string) {
  return request(`/api/pty/${id}`, { method: 'DELETE' });
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

/** Una sesión concreta (trae `cost` y `tokens` acumulados). */
export async function getSession(id: string): Promise<Session | null> {
  const res = await apiGet<{ data: Session } | Session>(`/api/session/${id}`);
  return 'data' in (res as object) ? ((res as { data: Session }).data ?? null) : (res as Session);
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
