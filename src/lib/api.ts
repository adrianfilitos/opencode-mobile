import * as SecureStore from 'expo-secure-store';

const KEY_URL = 'oc.baseUrl';
const KEY_TOKEN = 'oc.token';

export type Session = {
  id: string;
  projectID?: string;
  agent?: string;
  title?: string;
  model?: { id?: string; providerID?: string };
  time?: { created?: number; updated?: number };
};

type Creds = { baseUrl: string; token: string };

let cache: Creds | null = null;

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
  if (baseUrl && token) cache = { baseUrl, token };
  return cache;
}

export async function saveCreds(baseUrl: string, token: string) {
  cache = { baseUrl, token };
  await SecureStore.setItemAsync(KEY_URL, baseUrl);
  await SecureStore.setItemAsync(KEY_TOKEN, token);
}

export async function clearCreds() {
  cache = null;
  await SecureStore.deleteItemAsync(KEY_URL);
  await SecureStore.deleteItemAsync(KEY_TOKEN);
}

export function authHeader(token: string) {
  return 'Basic ' + b64('opencode:' + token);
}

export async function apiGet<T>(path: string): Promise<T> {
  const creds = await loadCreds();
  if (!creds) throw new Error('Sin conexión configurada');
  const res = await fetch(creds.baseUrl + path, {
    headers: { Authorization: authHeader(creds.token) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 180)}`);
  return JSON.parse(text) as T;
}

/** Devuelve true si el servidor responde y estamos autenticados. */
export async function ping(): Promise<boolean> {
  try {
    await apiGet('/api/info');
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
  const creds = await loadCreds();
  if (!creds) throw new Error('Sin conexión configurada');
  const res = await fetch(`${creds.baseUrl}/api/session/${sessionId}/prompt`, {
    method: 'POST',
    headers: { Authorization: authHeader(creds.token), 'Content-Type': 'application/json' },
    body: JSON.stringify(files && files.length > 0 ? { text, files } : { text }),
  });
  const t = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${t.slice(0, 180)}`);
  return t;
}

export async function interruptSession(sessionId: string) {
  const creds = await loadCreds();
  if (!creds) throw new Error('Sin conexión configurada');
  const res = await fetch(`${creds.baseUrl}/api/session/${sessionId}/interrupt`, {
    method: 'POST',
    headers: { Authorization: authHeader(creds.token) },
  });
  const t = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${t.slice(0, 180)}`);
  return t;
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
  const creds = await loadCreds();
  if (!creds) throw new Error('Sin conexión configurada');
  const res = await fetch(`${creds.baseUrl}/api/session/${sessionId}${path}`, {
    method,
    headers: {
      Authorization: authHeader(creds.token),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const t = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${t.slice(0, 180)}`);
  return t;
}

export function renameSession(sessionId: string, title: string) {
  return sessionAction(sessionId, '', 'PATCH', { title });
}

export async function forkSession(sessionId: string): Promise<{ id: string } | null> {
  const creds = await loadCreds();
  if (!creds) throw new Error('Sin conexión configurada');
  const res = await fetch(`${creds.baseUrl}/api/session/${sessionId}/fork`, {
    method: 'POST',
    headers: { Authorization: authHeader(creds.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const t = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${t.slice(0, 180)}`);
  const json = JSON.parse(t) as { data?: { id: string } } | { id: string };
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
  const creds = await loadCreds();
  if (!creds) throw new Error('Sin conexión configurada');
  const res = await fetch(`${creds.baseUrl}/api/session/${sessionId}/model`, {
    method: 'POST',
    headers: { Authorization: authHeader(creds.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  });
  const t = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${t.slice(0, 180)}`);
  return t;
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
  const creds = await loadCreds();
  if (!creds) throw new Error('Sin conexión configurada');
  const res = await fetch(`${creds.baseUrl}/api/session/${sessionId}/permission/${requestId}/reply`, {
    method: 'POST',
    headers: { Authorization: authHeader(creds.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
  const t = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${t.slice(0, 180)}`);
  return t;
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
  const creds = await loadCreds();
  if (!creds) throw new Error('Sin conexión configurada');
  const body = {
    location: { directory },
    agent: opts?.agent ?? DEFAULT_AGENT,
    model: opts?.model ?? DEFAULT_MODEL,
  };
  const res = await fetch(`${creds.baseUrl}/api/session`, {
    method: 'POST',
    headers: { Authorization: authHeader(creds.token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const t = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${t.slice(0, 180)}`);
  const json = JSON.parse(t) as { data?: { id: string } } | { id: string };
  return ('data' in json && json.data ? json.data : (json as { id: string })) as { id: string };
}

/** Nombre corto de una ruta: la última carpeta. */
export function shortPath(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? p;
}
