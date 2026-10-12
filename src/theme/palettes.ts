export type Palette = {
  id: string;
  name: string;
  dark: boolean;
  bg: string;
  panel: string;
  panel2: string;
  line: string;
  lineSoft: string;
  text: string;
  textSoft: string;
  dim: string;
  dimSoft: string;
  accent: string;
  ink: string;
  ok: string;
  warn: string;
  warnBg: string;
  warnLine: string;
  warnText: string;
};

const P = (
  id: string,
  name: string,
  dark: boolean,
  c: {
    bg: string;
    panel: string;
    panel2: string;
    line: string;
    lineSoft: string;
    text: string;
    textSoft: string;
    dim: string;
    dimSoft: string;
    accent: string;
    ink: string;
    warnBg: string;
    warnLine: string;
    warnText: string;
  }
): Palette => ({
  id,
  name,
  dark,
  ok: '#4ade80',
  warn: dark ? '#fbbf24' : '#b45309',
  ...c,
});

export const PALETTES: Palette[] = [
  P('midnight', 'Midnight', true, {
    bg: '#0d0d10', panel: '#131318', panel2: '#17171c', line: '#26262d', lineSoft: '#1c1c22',
    text: '#e9e9ee', textSoft: '#d5d5de', dim: '#8b8b98', dimSoft: '#6f6f7d', accent: '#7c9cff', ink: '#ffffff',
    warnBg: '#241d0e', warnLine: '#5c4a1c', warnText: '#e7d9a8',
  }),
  P('terminal', 'Terminal', true, {
    bg: '#060a07', panel: '#0a140d', panel2: '#0a140d', line: '#16301f', lineSoft: '#102418',
    text: '#86efac', textSoft: '#a7f3c4', dim: '#4f8f68', dimSoft: '#3d6e50', accent: '#22c55e', ink: '#04140a',
    warnBg: '#1a1509', warnLine: '#5c4a1c', warnText: '#fcd34d',
  }),
  P('nord', 'Nord', true, {
    bg: '#2e3440', panel: '#3b4252', panel2: '#3b4252', line: '#434c5e', lineSoft: '#3a4152',
    text: '#eceff4', textSoft: '#d8dee9', dim: '#a8b1c2', dimSoft: '#8b94a7', accent: '#88c0d0', ink: '#2e3440',
    warnBg: '#3d361f', warnLine: '#8a7a3a', warnText: '#fbe9a8',
  }),
  P('neon', 'Neon', true, {
    bg: '#0b0813', panel: '#151024', panel2: '#151024', line: '#2a1f45', lineSoft: '#201734',
    text: '#f0eaff', textSoft: '#ded2ff', dim: '#9a86c9', dimSoft: '#7a68a3', accent: '#d946ef', ink: '#ffffff',
    warnBg: '#2a1030', warnLine: '#7a2a86', warnText: '#f5c6ff',
  }),
  P('papel', 'Papel', false, {
    bg: '#faf6ef', panel: '#ffffff', panel2: '#ffffff', line: '#e0d6c2', lineSoft: '#ece4d4',
    text: '#2b2b2b', textSoft: '#4a463f', dim: '#9a8c72', dimSoft: '#b3a68c', accent: '#b5651d', ink: '#ffffff',
    warnBg: '#fdf3dd', warnLine: '#e2c98a', warnText: '#8a6a1f',
  }),
  P('ambar', 'Ámbar', true, {
    bg: '#14100a', panel: '#1c1710', panel2: '#1c1710', line: '#33291a', lineSoft: '#271f14',
    text: '#f5e9d6', textSoft: '#e6d6bb', dim: '#9c8b6f', dimSoft: '#7d6f58', accent: '#f59e0b', ink: '#1a1206',
    warnBg: '#2a2110', warnLine: '#6b5620', warnText: '#fbe0a8',
  }),
  P('oceano', 'Océano', true, {
    bg: '#06121a', panel: '#0b1a26', panel2: '#0b1a26', line: '#15303f', lineSoft: '#102533',
    text: '#d6f0f7', textSoft: '#b7e2ee', dim: '#7fa8b8', dimSoft: '#628a99', accent: '#22d3ee', ink: '#04252b',
    warnBg: '#12303a', warnLine: '#2f6d7d', warnText: '#c7f0f8',
  }),
  P('bosque', 'Bosque', true, {
    bg: '#0b1410', panel: '#101d17', panel2: '#101d17', line: '#1c3328', lineSoft: '#152720',
    text: '#dcefe2', textSoft: '#c2e0cb', dim: '#7fa891', dimSoft: '#63856f', accent: '#34d399', ink: '#06251a',
    warnBg: '#1d2a12', warnLine: '#4f6b2a', warnText: '#dcf0a8',
  }),
  P('vino', 'Vino', true, {
    bg: '#150a10', panel: '#1e0f18', panel2: '#1e0f18', line: '#3a1c2c', lineSoft: '#2c1521',
    text: '#f4dde8', textSoft: '#e6c4d5', dim: '#b0849b', dimSoft: '#8d6779', accent: '#fb7185', ink: '#2a0c15',
    warnBg: '#301623', warnLine: '#7a3a52', warnText: '#fbc7d4',
  }),
  P('grafito', 'Grafito', true, {
    bg: '#17171a', panel: '#1f1f23', panel2: '#1f1f23', line: '#2e2e34', lineSoft: '#26262b',
    text: '#e8e8ec', textSoft: '#d2d2d9', dim: '#9a9aa3', dimSoft: '#787881', accent: '#a1a1aa', ink: '#101013',
    warnBg: '#28241a', warnLine: '#6b5f42', warnText: '#e8d9b0',
  }),
  P('slate', 'Slate', true, {
    bg: '#0f1115', panel: '#161a20', panel2: '#161a20', line: '#242b34', lineSoft: '#1c2229',
    text: '#e2e8f0', textSoft: '#cbd5e1', dim: '#94a3b8', dimSoft: '#738298', accent: '#60a5fa', ink: '#0b1119',
    warnBg: '#252014', warnLine: '#6b5a2a', warnText: '#fbe3a8',
  }),
  P('vaporwave', 'Vaporwave', true, {
    bg: '#1a0b2e', panel: '#241140', panel2: '#241140', line: '#3b2160', lineSoft: '#2e1a4d',
    text: '#f5e6ff', textSoft: '#e3ccff', dim: '#b79ad6', dimSoft: '#9578b3', accent: '#ff71ce', ink: '#2a0a2a',
    warnBg: '#3a1030', warnLine: '#8a2a6a', warnText: '#ffc7e8',
  }),
  P('cafe', 'Café', true, {
    bg: '#1a1410', panel: '#241b15', panel2: '#241b15', line: '#3a2b20', lineSoft: '#2e221a',
    text: '#efe2d4', textSoft: '#e0cdb8', dim: '#a98f78', dimSoft: '#8a7360', accent: '#d4a373', ink: '#241608',
    warnBg: '#2e2416', warnLine: '#6b5730', warnText: '#f0dcb0',
  }),
  P('solarized', 'Solarized', true, {
    bg: '#002b36', panel: '#073642', panel2: '#073642', line: '#14505c', lineSoft: '#0d414c',
    text: '#93a1a1', textSoft: '#a8b5b5', dim: '#6b8489', dimSoft: '#547077', accent: '#b58900', ink: '#00212b',
    warnBg: '#3a3013', warnLine: '#7a6a22', warnText: '#e8d69a',
  }),
  P('solarizedclaro', 'Solarized Claro', false, {
    bg: '#fdf6e3', panel: '#ffffff', panel2: '#ffffff', line: '#e6decb', lineSoft: '#f0ebdc',
    text: '#586e75', textSoft: '#657b83', dim: '#93a1a1', dimSoft: '#aebcbc', accent: '#268bd2', ink: '#ffffff',
    warnBg: '#fdf6dd', warnLine: '#e0cf8a', warnText: '#8a7420',
  }),
  P('gruvbox', 'Gruvbox', true, {
    bg: '#282828', panel: '#32302f', panel2: '#32302f', line: '#45403d', lineSoft: '#3a3734',
    text: '#ebdbb2', textSoft: '#d5c4a1', dim: '#a89984', dimSoft: '#8a7d6b', accent: '#d79921', ink: '#2a2416',
    warnBg: '#3d3316', warnLine: '#7a6624', warnText: '#f0dfa0',
  }),
  P('dracula', 'Dracula', true, {
    bg: '#282a36', panel: '#313342', panel2: '#313342', line: '#414458', lineSoft: '#373a4a',
    text: '#f8f8f2', textSoft: '#e2e2f0', dim: '#9aa0b5', dimSoft: '#7b8299', accent: '#bd93f9', ink: '#241f33',
    warnBg: '#3a3050', warnLine: '#7a5fc0', warnText: '#e0d0ff',
  }),
  P('monokai', 'Monokai', true, {
    bg: '#272822', panel: '#30312a', panel2: '#30312a', line: '#45463c', lineSoft: '#393a32',
    text: '#f8f8f2', textSoft: '#e0e0da', dim: '#a6a28c', dimSoft: '#87836f', accent: '#a6e22e', ink: '#1e1f18',
    warnBg: '#3a3818', warnLine: '#7a7328', warnText: '#eae59a',
  }),
  P('sakura', 'Sakura', false, {
    bg: '#fdf2f8', panel: '#ffffff', panel2: '#ffffff', line: '#f0d7e5', lineSoft: '#f7e6ef',
    text: '#4a2b3c', textSoft: '#6b4258', dim: '#a1738c', dimSoft: '#c39bb0', accent: '#db2777', ink: '#ffffff',
    warnBg: '#fdeef4', warnLine: '#f0b6cf', warnText: '#a3496f',
  }),
  P('nieve', 'Nieve', false, {
    bg: '#f7f9fc', panel: '#ffffff', panel2: '#ffffff', line: '#e2e8f0', lineSoft: '#eef2f7',
    text: '#1e293b', textSoft: '#334155', dim: '#64748b', dimSoft: '#94a3b8', accent: '#2563eb', ink: '#ffffff',
    warnBg: '#fef6e7', warnLine: '#e6cf9a', warnText: '#8a6a1f',
  }),
];

export const DEFAULT_PALETTE = PALETTES[0];
