import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SectionLabel } from '@/components/settings-row';
import { haptic } from '@/lib/haptics';
import { usePrefs, type QuickAction } from '@/lib/prefs';
import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';

function useStyles() {
  const t = usePalette();
  return useMemo(() => makeStyles(t), [t]);
}

function Sym({ name, size = 15, color }: { name: string; size?: number; color?: string }) {
  const t = usePalette();
  return <SymbolView name={name as never} tintColor={color ?? t.dim} size={size} />;
}

export default function RapidasScreen() {
  const s = useStyles();
  const t = usePalette();
  const { prefs, setQuickActions } = usePrefs();
  const [editing, setEditing] = useState<QuickAction | null>(null);
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');

  const openNew = () => {
    haptic('tap');
    setEditing({ id: `qa-${Date.now()}`, label: '', text: '' });
    setLabel('');
    setText('');
  };

  const openEdit = (a: QuickAction) => {
    haptic('tap');
    setEditing(a);
    setLabel(a.label);
    setText(a.text);
  };

  const save = () => {
    if (!editing) return;
    if (!label.trim() || !text.trim()) return;
    const next = editing.label
      ? prefs.quickActions.map((a) =>
          a.id === editing.id ? { ...a, label: label.trim(), text: text.trim() } : a
        )
      : [...prefs.quickActions, { id: editing.id, label: label.trim(), text: text.trim() }];
    setQuickActions(next);
    haptic('success');
    setEditing(null);
  };

  const remove = (a: QuickAction) => {
    Alert.alert('Borrar acción', `¿Quitar «${a.label}»?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => {
          haptic('warning');
          setQuickActions(prefs.quickActions.filter((x) => x.id !== a.id));
        },
      },
    ]);
  };

  const move = (index: number, dir: -1 | 1) => {
    const list = [...prefs.quickActions];
    const to = index + dir;
    if (to < 0 || to >= list.length) return;
    [list[index], list[to]] = [list[to], list[index]];
    haptic('select');
    setQuickActions(list);
  };

  const isNew = editing ? !prefs.quickActions.some((a) => a.id === editing.id) : false;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <SectionLabel>Tus acciones</SectionLabel>
      {prefs.quickActions.length === 0 ? (
        <Text style={s.hint}>Todavía no hay ninguna. Añade tu primera frase.</Text>
      ) : (
        prefs.quickActions.map((a, i) => (
          <View key={a.id} style={s.row}>
            <Pressable style={{ flex: 1 }} onPress={() => openEdit(a)}>
              <Text style={s.label}>{a.label}</Text>
              <Text style={s.text} numberOfLines={2}>
                {a.text}
              </Text>
            </Pressable>
            <Pressable hitSlop={8} onPress={() => move(i, -1)} disabled={i === 0}>
              <Sym name="chevron.up" size={14} color={i === 0 ? t.line : t.dim} />
            </Pressable>
            <Pressable hitSlop={8} onPress={() => move(i, 1)} disabled={i === prefs.quickActions.length - 1}>
              <Sym
                name="chevron.down"
                size={14}
                color={i === prefs.quickActions.length - 1 ? t.line : t.dim}
              />
            </Pressable>
            <Pressable hitSlop={8} onPress={() => remove(a)}>
              <Sym name="trash" size={14} color="#fca5a5" />
            </Pressable>
          </View>
        ))
      )}

      <Pressable style={[s.add, { backgroundColor: t.accent }]} onPress={openNew}>
        <Sym name="plus" size={15} color={t.ink} />
        <Text style={[s.addText, { color: t.ink }]}>Añadir acción</Text>
      </Pressable>
      <Text style={s.hint}>
        Aparecen como chips justo encima del cuadro de escribir. Al tocarlas, rellenan el mensaje.
      </Text>

      <Modal visible={!!editing} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
        <View style={s.modalRoot}>
          <Pressable style={s.modalScrim} onPress={() => setEditing(null)} />
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{isNew ? 'Nueva acción' : 'Editar acción'}</Text>
            <Text style={s.fieldLabel}>Nombre corto</Text>
            <TextInput
              style={s.input}
              value={label}
              onChangeText={setLabel}
              placeholder="Tests"
              placeholderTextColor={t.dim}
              autoFocus
            />
            <Text style={s.fieldLabel}>Mensaje que se escribe</Text>
            <TextInput
              style={[s.input, s.inputMulti]}
              value={text}
              onChangeText={setText}
              placeholder="Corre los tests y arregla lo que falle."
              placeholderTextColor={t.dim}
              multiline
            />
            <View style={s.modalButtons}>
              <Pressable style={s.ghost} onPress={() => setEditing(null)}>
                <Text style={s.ghostText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[s.primary, { backgroundColor: t.accent, borderColor: t.accent }]}
                onPress={save}>
                <Text style={[s.primaryText, { color: t.ink }]}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 40 },
    hint: { color: t.dimSoft, fontSize: 11.5, lineHeight: 17, marginTop: 10, marginHorizontal: 4 },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 13,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.lineSoft,
    },
    label: { color: t.text, fontSize: 14, fontWeight: '600' },
    text: { color: t.dimSoft, fontSize: 11.5, marginTop: 3, lineHeight: 16 },

    add: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 11,
      paddingVertical: 12,
      marginTop: 18,
    },
    addText: { fontSize: 14, fontWeight: '600' },

    modalRoot: { flex: 1, justifyContent: 'center', padding: 20 },
    modalScrim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.65)',
    },
    modalCard: {
      backgroundColor: t.panel2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 16,
      padding: 16,
    },
    modalTitle: { color: t.text, fontSize: 15, fontWeight: '700', marginBottom: 12 },
    fieldLabel: {
      color: t.dimSoft,
      fontSize: 10.5,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: 6,
      marginTop: 8,
    },
    input: {
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: t.text,
      fontSize: 14,
    },
    inputMulti: { minHeight: 74, textAlignVertical: 'top' },
    modalButtons: { flexDirection: 'row', gap: 9, marginTop: 18 },
    ghost: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 11,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
    },
    ghostText: { color: t.textSoft, fontSize: 13.5, fontWeight: '600' },
    primary: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 11,
      borderWidth: StyleSheet.hairlineWidth,
    },
    primaryText: { fontSize: 13.5, fontWeight: '600' },
  });
