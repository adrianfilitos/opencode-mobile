import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { DEFAULT_PALETTE, PALETTES, type Palette } from './palettes';

const KEY_THEME = 'oc.theme';
const KEY_ACCENT = 'oc.accent';

export const ACCENTS: { id: string; name: string; color: string }[] = [
  { id: 'default', name: 'Del tema', color: '' },
  { id: 'blue', name: 'Azul', color: '#7c9cff' },
  { id: 'violet', name: 'Violeta', color: '#a78bfa' },
  { id: 'teal', name: 'Turquesa', color: '#2dd4bf' },
  { id: 'green', name: 'Verde', color: '#34d399' },
  { id: 'amber', name: 'Ámbar', color: '#fbbf24' },
  { id: 'rose', name: 'Rosa', color: '#fb7185' },
  { id: 'cyan', name: 'Cian', color: '#22d3ee' },
];

type Density = 'compact' | 'comfortable' | 'spacious';

type Ctx = {
  palette: Palette;
  themeId: string;
  accentOverride: string | null;
  density: Density;
  flat: boolean;
  setTheme: (id: string) => void;
  setAccent: (color: string | null) => void;
  setDensity: (d: Density) => void;
  setFlat: (v: boolean) => void;
};

const ThemeCtx = createContext<Ctx>({
  palette: DEFAULT_PALETTE,
  themeId: DEFAULT_PALETTE.id,
  accentOverride: null,
  density: 'comfortable',
  flat: false,
  setTheme: () => {},
  setAccent: () => {},
  setDensity: () => {},
  setFlat: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState(DEFAULT_PALETTE.id);
  const [accentOverride, setAccentOverride] = useState<string | null>(null);
  const [density, setDensityState] = useState<Density>('comfortable');
  const [flat, setFlatState] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(KEY_THEME)
      .then((v) => v && setThemeId(v))
      .catch(() => {});
    SecureStore.getItemAsync(KEY_ACCENT)
      .then((v) => v && setAccentOverride(v))
      .catch(() => {});
    SecureStore.getItemAsync('oc.density')
      .then((v) => v && setDensityState(v as Density))
      .catch(() => {});
    SecureStore.getItemAsync('oc.flat')
      .then((v) => setFlatState(v === '1'))
      .catch(() => {});
  }, []);

  const value = useMemo<Ctx>(() => {
    const base = PALETTES.find((p) => p.id === themeId) ?? DEFAULT_PALETTE;
    const palette = accentOverride ? { ...base, accent: accentOverride } : base;
    return {
      palette,
      themeId,
      accentOverride,
      density,
      flat,
      setTheme: (id: string) => {
        setThemeId(id);
        SecureStore.setItemAsync(KEY_THEME, id).catch(() => {});
      },
      setAccent: (color: string | null) => {
        setAccentOverride(color);
        if (color) SecureStore.setItemAsync(KEY_ACCENT, color).catch(() => {});
        else SecureStore.deleteItemAsync(KEY_ACCENT).catch(() => {});
      },
      setDensity: (d: Density) => {
        setDensityState(d);
        SecureStore.setItemAsync('oc.density', d).catch(() => {});
      },
      setFlat: (v: boolean) => {
        setFlatState(v);
        SecureStore.setItemAsync('oc.flat', v ? '1' : '0').catch(() => {});
      },
    };
  }, [themeId, accentOverride, density, flat]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}

export function usePalette(): Palette {
  return useContext(ThemeCtx).palette;
}

export type { Palette };
