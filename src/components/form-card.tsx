import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { FormAnswer, FormField, FormInfo } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';

/** Valor que puede llevar un campo del formulario mientras se rellena. */
type Value = string | number | boolean | string[] | undefined;

function useStyles() {
  const t = usePalette();
  return useMemo(() => makeStyles(t), [t]);
}

function Sym({ name, size = 15, color }: { name: string; size?: number; color?: string }) {
  const t = usePalette();
  return <SymbolView name={name as never} tintColor={color ?? t.dim} size={size} />;
}

/** ¿Se muestra este campo, según sus condiciones `when`? */
function isVisible(f: FormField, answers: Record<string, Value>): boolean {
  if (f.hidden) return false;
  if (!f.when || f.when.length === 0) return true;
  return f.when.every((w) => {
    const cur = answers[w.key];
    return w.op === 'eq' ? cur === w.value : cur !== w.value;
  });
}

/** Valores iniciales a partir de los `default` de cada campo. */
function initialAnswers(fields: FormField[]): Record<string, Value> {
  const out: Record<string, Value> = {};
  for (const f of fields) {
    if (f.default !== undefined) out[f.key] = f.default as Value;
    else if (f.type === 'multiselect') out[f.key] = [];
  }
  return out;
}

function labelOf(f: FormField): string {
  return f.title?.trim() || f.key;
}

function isEmpty(v: Value): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function Field({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: Value;
  onChange: (v: Value) => void;
}) {
  const s = useStyles();
  const t = usePalette();
  const title = labelOf(field);
  const req = field.required ? ' *' : '';

  // ---- Sí / No ----
  if (field.type === 'boolean') {
    return (
      <View style={s.field}>
        <Text style={s.fieldTitle}>
          {title}
          <Text style={{ color: t.accent }}>{req}</Text>
        </Text>
        {field.description ? <Text style={s.fieldDesc}>{field.description}</Text> : null}
        <View style={s.seg}>
          {[true, false].map((b) => {
            const on = value === b;
            return (
              <Pressable
                key={String(b)}
                style={[s.segBtn, on && { backgroundColor: t.accent, borderColor: t.accent }]}
                onPress={() => {
                  haptic('select');
                  onChange(b);
                }}>
                <Text style={[s.segText, on && { color: t.ink, fontWeight: '700' }]}>{b ? 'Sí' : 'No'}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  // ---- Enlace externo (no se responde, solo se abre) ----
  if (field.type === 'external') {
    return (
      <View style={s.field}>
        <Text style={s.fieldTitle}>{title}</Text>
        {field.description ? <Text style={s.fieldDesc}>{field.description}</Text> : null}
        {field.url ? (
          <Pressable style={s.extBtn} onPress={() => Linking.openURL(field.url as string)}>
            <Sym name="arrow.up.right.square" size={14} color={t.accent} />
            <Text style={[s.extText, { color: t.accent }]} numberOfLines={1}>
              {field.url}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  // ---- Opciones (una sola, tipo question) o multiselección ----
  if (field.type === 'multiselect' || (field.type === 'string' && field.options && field.options.length > 0)) {
    const multi = field.type === 'multiselect';
    const options = field.options ?? [];
    const selected: string[] = multi
      ? Array.isArray(value)
        ? value
        : []
      : typeof value === 'string' && value
        ? [value]
        : [];
    const hasCustom = !multi && !!field.custom;
    const isKnown = options.some((o) => o.value === value);
    const toggle = (val: string) => {
      haptic('select');
      if (multi) {
        const set = new Set(selected);
        if (set.has(val)) set.delete(val);
        else set.add(val);
        onChange([...set]);
      } else {
        onChange(selected[0] === val ? '' : val);
      }
    };
    return (
      <View style={s.field}>
        <Text style={s.fieldTitle}>
          {title}
          <Text style={{ color: t.accent }}>{req}</Text>
        </Text>
        {field.description ? <Text style={s.fieldDesc}>{field.description}</Text> : null}
        <View style={{ gap: 7 }}>
          {options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <Pressable
                key={o.value}
                style={[s.opt, on && { borderColor: t.accent, backgroundColor: t.panel2 }]}
                onPress={() => toggle(o.value)}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.optLabel, on && { color: t.text }]}>{o.label}</Text>
                  {o.description ? <Text style={s.optDesc}>{o.description}</Text> : null}
                </View>
                <Sym
                  name={on ? 'checkmark.circle.fill' : 'circle'}
                  size={16}
                  color={on ? t.accent : t.dimSoft}
                />
              </Pressable>
            );
          })}
        </View>
        {hasCustom ? (
          <TextInput
            style={[s.input, { marginTop: 8 }]}
            placeholder="Otro…"
            placeholderTextColor={t.dim}
            value={typeof value === 'string' && value && !isKnown ? value : ''}
            onChangeText={onChange}
          />
        ) : null}
      </View>
    );
  }

  // ---- Número / entero ----
  if (field.type === 'number' || field.type === 'integer') {
    return (
      <View style={s.field}>
        <Text style={s.fieldTitle}>
          {title}
          <Text style={{ color: t.accent }}>{req}</Text>
        </Text>
        {field.description ? <Text style={s.fieldDesc}>{field.description}</Text> : null}
        <TextInput
          style={s.input}
          keyboardType="numeric"
          placeholder={field.placeholder ?? (field.type === 'integer' ? 'Número entero' : 'Número')}
          placeholderTextColor={t.dim}
          value={value === undefined || value === null ? '' : String(value)}
          onChangeText={(txt) => {
            if (txt.trim() === '') return onChange(undefined);
            const n = field.type === 'integer' ? parseInt(txt.replace(/[^0-9-]/g, ''), 10) : Number(txt);
            onChange(Number.isNaN(n) ? undefined : n);
          }}
        />
      </View>
    );
  }

  // ---- Texto libre ----
  return (
    <View style={s.field}>
      <Text style={s.fieldTitle}>
        {title}
        <Text style={{ color: t.accent }}>{req}</Text>
      </Text>
      {field.description ? <Text style={s.fieldDesc}>{field.description}</Text> : null}
      <TextInput
        style={s.input}
        placeholder={field.placeholder ?? ''}
        placeholderTextColor={t.dim}
        multiline
        autoCapitalize={field.format === 'email' || field.format === 'uri' ? 'none' : 'sentences'}
        keyboardType={field.format === 'email' ? 'email-address' : field.format === 'uri' ? 'url' : 'default'}
        value={typeof value === 'string' ? value : ''}
        onChangeText={onChange}
      />
    </View>
  );
}

/** Tarjeta para responder una *question* (formulario) del agente. */
export default function FormCard({
  form,
  onReply,
  onCancel,
}: {
  form: FormInfo;
  onReply: (answer: FormAnswer) => void;
  onCancel?: () => void;
}) {
  const s = useStyles();
  const t = usePalette();
  const [answers, setAnswers] = useState<Record<string, Value>>(() => initialAnswers(form.fields));
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const visible = form.fields.filter((f) => isVisible(f, answers));

  function submit() {
    if (sent) return;
    const answer: FormAnswer = {};
    for (const f of visible) {
      if (f.type === 'external') continue;
      const v = answers[f.key];

      if (f.type === 'boolean') {
        if (typeof v === 'boolean') answer[f.key] = v;
        else if (f.required) return fail(f);
        continue;
      }
      if (isEmpty(v)) {
        if (f.required) return fail(f);
        continue;
      }
      if (Array.isArray(v)) answer[f.key] = v;
      else if (typeof v === 'string') answer[f.key] = v.trim();
      else answer[f.key] = v as number | boolean;
    }
    setErr(null);
    setSent(true);
    haptic('success');
    onReply(answer);
  }

  function fail(f: FormField) {
    setErr(`«${labelOf(f)}» necesita respuesta`);
    haptic('error');
  }

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Sym name="questionmark.bubble.fill" size={16} color={t.accent} />
        <Text style={s.title} numberOfLines={3}>
          {form.title}
        </Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: 2 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {visible.map((f) => (
          <Field
            key={f.key}
            field={f}
            value={answers[f.key]}
            onChange={(v) => {
              setErr(null);
              setAnswers((a) => ({ ...a, [f.key]: v }));
            }}
          />
        ))}
      </ScrollView>

      {err ? <Text style={s.err}>{err}</Text> : null}

      <View style={s.actions}>
        <Pressable
          style={[s.send, { backgroundColor: t.accent }, sent && { opacity: 0.6 }]}
          onPress={submit}
          disabled={sent}>
          {sent ? (
            <ActivityIndicator size="small" color={t.ink} />
          ) : (
            <Text style={[s.sendText, { color: t.ink }]}>Responder</Text>
          )}
        </Pressable>
        {onCancel ? (
          <Pressable style={s.cancel} onPress={onCancel} disabled={sent}>
            <Text style={s.cancelText}>Cancelar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    card: {
      marginHorizontal: 13,
      marginBottom: 8,
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 14,
      padding: 12,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    title: { color: t.text, fontSize: 13.5, fontWeight: '700', flex: 1 },

    scroll: { maxHeight: 330 },
    field: { marginBottom: 12 },
    fieldTitle: { color: t.textSoft, fontSize: 13, fontWeight: '600', marginBottom: 3 },
    fieldDesc: { color: t.dim, fontSize: 11.5, marginBottom: 6, lineHeight: 16 },

    input: {
      backgroundColor: t.panel2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      color: t.text,
      fontSize: 13.5,
      minHeight: 42,
    },

    seg: { flexDirection: 'row', gap: 8 },
    segBtn: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 10,
      paddingVertical: 9,
      alignItems: 'center',
    },
    segText: { color: t.textSoft, fontSize: 13, fontWeight: '600' },

    opt: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 10,
      paddingHorizontal: 11,
      paddingVertical: 10,
    },
    optLabel: { color: t.textSoft, fontSize: 13, fontWeight: '600' },
    optDesc: { color: t.dim, fontSize: 11.5, marginTop: 2, lineHeight: 15 },

    extBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 10,
      paddingHorizontal: 11,
      paddingVertical: 10,
    },
    extText: { fontSize: 12.5, flexShrink: 1 },

    err: { color: '#fca5a5', fontSize: 12, marginBottom: 8 },
    actions: { flexDirection: 'row', gap: 8, marginTop: 2 },
    send: {
      flex: 1,
      borderRadius: 10,
      paddingVertical: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendText: { fontSize: 13.5, fontWeight: '700' },
    cancel: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 10,
      paddingHorizontal: 18,
      paddingVertical: 11,
      alignItems: 'center',
    },
    cancelText: { color: t.dim, fontSize: 13, fontWeight: '600' },
  });
