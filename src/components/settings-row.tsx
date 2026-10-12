import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';

function useStyles() {
  const t = usePalette();
  return useMemo(() => makeStyles(t), [t]);
}

export function Sym({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  const t = usePalette();
  return <SymbolView name={name as never} tintColor={color ?? t.dim} size={size} />;
}

export function SectionLabel({ children }: { children: string }) {
  const s = useStyles();
  return <Text style={s.section}>{children}</Text>;
}

type Props = {
  icon?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value?: string;
  chevron?: boolean;
  check?: boolean;
  onPress?: () => void;
  last?: boolean;
};

export function SettingsRow({ icon, iconColor, title, subtitle, value, chevron, check, onPress, last }: Props) {
  const s = useStyles();
  const t = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.row, !last && s.rowBorder, pressed && onPress ? { backgroundColor: t.panel } : null]}>
      {icon ? (
        <View style={s.iconWrap}>
          <Sym name={icon} size={16} color={iconColor ?? t.dim} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={s.title}>{title}</Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={s.value}>{value}</Text> : null}
      {check ? <Sym name="checkmark" size={15} color={t.accent} /> : null}
      {chevron ? <Sym name="chevron.right" size={14} color={t.dimSoft} /> : null}
    </Pressable>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    section: {
      color: t.dimSoft,
      fontSize: 10.5,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginTop: 18,
      marginBottom: 6,
      marginHorizontal: 4,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 6, paddingVertical: 14 },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.lineSoft },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 9,
      backgroundColor: t.panel2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { color: t.text, fontSize: 14 },
    subtitle: { color: t.dimSoft, fontSize: 11.5, marginTop: 3 },
    value: { color: t.dim, fontSize: 13, marginRight: 4 },
  });
