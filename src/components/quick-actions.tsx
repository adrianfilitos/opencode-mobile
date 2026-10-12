import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { QuickAction } from '@/lib/prefs';
import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';

function useStyles() {
  const t = usePalette();
  return useMemo(() => makeStyles(t), [t]);
}

/** Chips con tus frases de siempre, encima del cuadro de escribir. */
export default function QuickActions({
  actions,
  onPick,
  onEdit,
}: {
  actions: QuickAction[];
  onPick: (a: QuickAction) => void;
  onEdit: () => void;
}) {
  const s = useStyles();
  const t = usePalette();
  if (actions.length === 0) return null;
  return (
    <View style={s.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.row}
        keyboardShouldPersistTaps="always">
        {actions.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => onPick(a)}
            style={({ pressed }) => [s.chip, pressed && { backgroundColor: t.panel2 }]}>
            <Text style={s.chipText} numberOfLines={1}>
              {a.label}
            </Text>
          </Pressable>
        ))}
        <Pressable onPress={onEdit} style={s.edit} hitSlop={8}>
          <Text style={s.editText}>editar</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    wrap: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.lineSoft,
    },
    row: { gap: 7, paddingHorizontal: 13, paddingVertical: 8, alignItems: 'center' },
    chip: {
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      maxWidth: 190,
    },
    chipText: { color: t.textSoft, fontSize: 12.5, fontWeight: '600' },
    edit: { paddingHorizontal: 6, paddingVertical: 7 },
    editText: { color: t.dimSoft, fontSize: 11.5 },
  });
