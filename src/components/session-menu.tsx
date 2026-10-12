import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';

function useStyles() {
  const t = usePalette();
  return useMemo(() => makeStyles(t), [t]);
}

function Sym({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  const t = usePalette();
  return <SymbolView name={name as never} tintColor={color ?? t.dim} size={size} />;
}

function Row({
  icon,
  label,
  onPress,
  danger,
  last,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  const s = useStyles();
  return (
    <Pressable style={[s.row, !last && s.rowBorder]} onPress={onPress}>
      <Sym name={icon} size={16} color={danger ? '#fca5a5' : undefined} />
      <Text style={[s.rowText, danger && { color: '#fca5a5' }]}>{label}</Text>
    </Pressable>
  );
}

export default function SessionMenu({
  visible,
  title,
  onClose,
  onRename,
  onFork,
  onCompact,
  onDelete,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onRename: (t: string) => void;
  onFork: () => void;
  onCompact: () => void;
  onDelete: () => void;
}) {
  const s = useStyles();
  const t = usePalette();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title);

  useEffect(() => {
    if (visible) {
      setRenaming(false);
      setDraft(title);
    }
  }, [visible, title]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <Pressable style={s.scrim} onPress={onClose} />
        <View style={s.card}>
          <View style={s.grab} />
          <Text style={s.title} numberOfLines={1}>
            {title}
          </Text>

          {renaming ? (
            <View style={{ paddingTop: 6 }}>
              <TextInput
                style={s.input}
                value={draft}
                onChangeText={setDraft}
                placeholder="Nombre de la sesión"
                placeholderTextColor={t.dimSoft}
                autoFocus
              />
              <Pressable
                style={[s.saveBtn, { backgroundColor: t.accent }]}
                onPress={() => {
                  const v = draft.trim();
                  if (v) onRename(v);
                }}>
                <Text style={[s.saveText, { color: t.ink }]}>Guardar</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Row icon="pencil" label="Renombrar" onPress={() => setRenaming(true)} />
              <Row icon="arrow.triangle.branch" label="Duplicar (fork)" onPress={onFork} />
              <Row icon="arrow.down.right.and.arrow.up.left" label="Compactar" onPress={onCompact} />
              <Row icon="trash" label="Eliminar sesión" danger last onPress={onDelete} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
    card: {
      backgroundColor: t.panel2,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      paddingHorizontal: 16,
      paddingBottom: 34,
    },
    grab: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.line,
      alignSelf: 'center',
      marginTop: 7,
      marginBottom: 10,
    },
    title: { color: t.dim, fontSize: 13, marginBottom: 6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15 },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.lineSoft },
    rowText: { color: t.text, fontSize: 15 },
    input: {
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 11,
      paddingHorizontal: 13,
      paddingVertical: 11,
      color: t.text,
      fontSize: 14,
    },
    saveBtn: { borderRadius: 11, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
    saveText: { fontSize: 14.5, fontWeight: '600' },
  });
