import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { setHapticsEnabled } from '@/lib/haptics';
import { setTypingHapticsEnabled } from '@/lib/typing-haptics';

const KEY = 'oc.prefs';

export type QuickAction = { id: string; label: string; text: string };

export type Prefs = {
  /** Agente que se usa al crear sesiones nuevas. */
  agent: string;
  /** Modelo por defecto de las sesiones nuevas. */
  modelId: string;
  providerID: string;
  /** Razonamiento por defecto (low/medium/high) o null = el del modelo. */
  variant: string | null;
  haptics: boolean;
  /** Vibración suave mientras el agente escribe, al ritmo de la respuesta. */
  typingHaptics: boolean;
  /** Aviso dentro de la app cuando el agente termina. */
  inAppNotify: boolean;
  /** Enviar al agente sin interrumpir (steering). */
  steer: boolean;
  /** Tema de ntfy para probar los avisos (no se sube al repo). */
  ntfyTopic: string;
  quickActions: QuickAction[];
};

export const DEFAULT_PREFS: Prefs = {
  agent: 'build',
  modelId: 'deepseek-flash',
  providerID: 'deepseek',
  variant: null,
  haptics: true,
  typingHaptics: true,
  inAppNotify: true,
  steer: false,
  ntfyTopic: '',
  quickActions: [
    { id: 'qa-1', label: 'Tests', text: 'Corre los tests y arregla lo que falle.' },
    { id: 'qa-2', label: 'Commit', text: 'Haz un commit con los cambios actuales.' },
    { id: 'qa-3', label: 'Resumen', text: 'Resume en 3 puntos qué has cambiado.' },
  ],
};

type Ctx = {
  prefs: Prefs;
  set: (patch: Partial<Prefs>) => void;
  setQuickActions: (list: QuickAction[]) => void;
  /** { id, providerID } listo para la API. */
  model: { id: string; providerID: string };
};

const PrefsCtx = createContext<Ctx>({
  prefs: DEFAULT_PREFS,
  set: () => {},
  setQuickActions: () => {},
  model: { id: DEFAULT_PREFS.modelId, providerID: DEFAULT_PREFS.providerID },
});

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<Prefs>;
        setPrefs((p) => {
          const merged = { ...p, ...saved };
          // Arreglo: versiones anteriores guardaban el NOMBRE del agente
          // («Build») en vez de su id («build»), y las sesiones nuevas morían
          // con AgentNotFoundError. Los ids de agente van en minúscula.
          if (typeof merged.agent === 'string' && merged.agent !== merged.agent.toLowerCase()) {
            merged.agent = merged.agent.toLowerCase();
          }
          return merged;
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setHapticsEnabled(prefs.haptics);
    setTypingHapticsEnabled(prefs.haptics && prefs.typingHaptics);
  }, [prefs.haptics, prefs.typingHaptics]);

  const value = useMemo<Ctx>(() => {
    const save = (next: Prefs) => {
      setPrefs(next);
      SecureStore.setItemAsync(KEY, JSON.stringify(next)).catch(() => {});
    };
    return {
      prefs,
      set: (patch) => save({ ...prefs, ...patch }),
      setQuickActions: (list) => save({ ...prefs, quickActions: list }),
      model: { id: prefs.modelId, providerID: prefs.providerID },
    };
  }, [prefs]);

  return <PrefsCtx.Provider value={value}>{children}</PrefsCtx.Provider>;
}

export function usePrefs() {
  return useContext(PrefsCtx);
}
