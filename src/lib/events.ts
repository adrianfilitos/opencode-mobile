import { useEffect, useState } from 'react';

import { authHeader, loadCreds, ping } from '@/lib/api';

export type SseEvent = {
  type: string;
  data?: {
    sessionID?: string;
    assistantMessageID?: string;
    delta?: string;
    ordinal?: number;
    [k: string]: unknown;
  };
};

export type ConnState = 'connecting' | 'online' | 'offline';

type Listener = (e: SseEvent) => void;

/**
 * Una única conexión SSE para toda la app, que reparte los eventos entre
 * todos los que escuchen (el chat y el aviso emergente). También mantiene
 * el estado de conexión que pinta el puntito de la cabecera.
 */
const listeners = new Set<Listener>();
const connListeners = new Set<(s: ConnState) => void>();

let state: ConnState = 'connecting';
let started = false;
let closed = false;
let xhr: XMLHttpRequest | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;

export function connectionState(): ConnState {
  return state;
}

/** Hook de React con el estado de conexión actual. */
export function useConnection(): ConnState {
  const [st, setSt] = useState<ConnState>(connectionState());
  useEffect(() => onConnection(setSt), []);
  return st;
}

function setState(s: ConnState) {
  if (state === s) return;
  state = s;
  connListeners.forEach((f) => {
    try {
      f(s);
    } catch {
      /* ignorar */
    }
  });
}

/** Avisa cuando cambia el estado de conexión. Llama ya con el actual. */
export function onConnection(fn: (s: ConnState) => void) {
  connListeners.add(fn);
  fn(state);
  return () => {
    connListeners.delete(fn);
  };
}

export function subscribeEvents(fn: Listener) {
  listeners.add(fn);
  ensureStarted();
  return () => {
    listeners.delete(fn);
  };
}

function emit(e: SseEvent) {
  listeners.forEach((f) => {
    try {
      f(e);
    } catch {
      /* un oyente roto no debe tumbar al resto */
    }
  });
}

function ensureStarted() {
  if (started) return;
  started = true;
  closed = false;

  const beat = () => {
    ping()
      .then((ok) => setState(ok ? 'online' : 'offline'))
      .catch(() => setState('offline'));
  };
  beat();
  heartbeat = setInterval(beat, 12000);

  connect();
}

function connect() {
  if (closed) return;

  const scheduleRetry = () => {
    setState('offline');
    if (retry) return;
    retry = setTimeout(() => {
      retry = null;
      connect();
    }, 1800);
  };

  loadCreds()
    .then((creds) => {
      if (!creds || closed) {
        setState('offline');
        return;
      }
      let seen = 0;
      const x = new XMLHttpRequest();
      xhr = x;
      x.open('GET', `${creds.baseUrl}/api/event`);
      x.setRequestHeader('Authorization', authHeader(creds.token));
      x.setRequestHeader('Accept', 'text/event-stream');

      x.onreadystatechange = () => {
        if (closed) return;
        if (x.readyState === 3) {
          const text = x.responseText ?? '';
          if (text.length > seen) setState('online');
          const chunk = text.slice(seen);
          seen = text.length;
          for (const raw of chunk.split('\n')) {
            const line = raw.trim();
            if (!line.startsWith('data:')) continue;
            try {
              const json = JSON.parse(line.slice(5).trim()) as SseEvent;
              if (json.type) emit(json);
            } catch {
              /* trozo incompleto: se recupera en el siguiente */
            }
          }
        } else if (x.readyState === 4) {
          scheduleRetry();
        }
      };
      x.onerror = scheduleRetry;
      x.send();
    })
    .catch(() => setState('offline'));
}

/** Corta la conexión y el latido (solo lo usa el cierre de la app). */
export function stopEvents() {
  closed = true;
  started = false;
  if (retry) clearTimeout(retry);
  if (heartbeat) clearInterval(heartbeat);
  retry = null;
  heartbeat = null;
  try {
    xhr?.abort();
  } catch {
    /* ignorar */
  }
  xhr = null;
}
