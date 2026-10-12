import * as Clipboard from 'expo-clipboard';
import { SymbolView } from 'expo-symbols';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { createPairing, getKnownUrls } from '@/lib/api';
import { haptic } from '@/lib/haptics';
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

export default function EmparejarScreen() {
  const s = useStyles();
  const t = usePalette();
  const [urls, setUrls] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [code, setCode] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState(0);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getKnownUrls()
      .then((u) => setUrls(u))
      .catch(() => setUrls([]));
  }, []);

  // cuenta atrás hasta que caduque el código
  useEffect(() => {
    if (left <= 0) return;
    const id = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [left]);

  const base = urls[idx] ?? '';
  const link = code && base ? `${base}/auth/connect/${code}` : '';
  const expired = code !== null && left <= 0;

  const generate = useCallback(async () => {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const p = await createPairing();
      setCode(p.code);
      setExpiresIn(p.expires_in);
      setLeft(p.expires_in);
      haptic('success');
    } catch (e) {
      haptic('error');
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: 'Emparejar' }} />

      <Text style={s.intro}>
        Genera un código de <Text style={{ fontWeight: '700' }}>un solo uso</Text> para vincular
        otro dispositivo (por ejemplo, otro móvil) sin tocar el PC.
      </Text>

      {urls.length > 1 ? (
        <>
          <Text style={s.label}>Dirección a usar</Text>
          <View style={s.chips}>
            {urls.map((u, i) => {
              const on = i === idx;
              return (
                <Pressable
                  key={u}
                  style={[s.chip, on && { backgroundColor: t.accent, borderColor: t.accent }]}
                  onPress={() => {
                    haptic('select');
                    setIdx(i);
                  }}>
                  <Text style={[s.chipText, on && { color: t.ink, fontWeight: '700' }]} numberOfLines={1}>
                    {u.replace(/^https?:\/\//, '').split(':')[0]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <Pressable
        style={[s.btn, { backgroundColor: t.accent, borderColor: t.accent }, busy && { opacity: 0.6 }]}
        onPress={generate}
        disabled={busy}>
        {busy ? (
          <ActivityIndicator size="small" color={t.ink} />
        ) : (
          <>
            <Sym name="qrcode" size={15} color={t.ink} />
            <Text style={[s.btnText, { color: t.ink }]}>
              {code ? 'Generar otro código' : 'Generar código'}
            </Text>
          </>
        )}
      </Pressable>

      {error ? <Text style={s.error}>{error}</Text> : null}

      {link ? (
        <>
          <Text style={s.label}>Enlace de emparejamiento</Text>
          <View style={s.linkBox}>
            <Text style={s.linkText} selectable>
              {link}
            </Text>
          </View>
          <Pressable
            style={[s.copy, copied && { borderColor: t.ok }]}
            onPress={async () => {
              await Clipboard.setStringAsync(link);
              haptic('tap');
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}>
            <Sym name={copied ? 'checkmark' : 'doc.on.doc'} size={14} color={copied ? t.ok : t.dim} />
            <Text style={[s.copyText, copied && { color: t.ok }]}>
              {copied ? 'Copiado' : 'Copiar enlace'}
            </Text>
          </Pressable>

          <Text style={[s.expiry, expired && { color: '#fca5a5' }]}>
            {expired
              ? 'El código ha caducado. Genera otro.'
              : `Caduca en ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} (${expiresIn}s)`}
          </Text>

          <Text style={s.steps}>
            En el otro dispositivo: abre la app → «Conectar» → pega este enlace → Conectar. Ojo:
            cada código vale una sola vez.
          </Text>
        </>
      ) : null}

      {urls.length === 0 ? (
        <Text style={s.note}>Aún no hay direcciones conocidas (empareja primero este dispositivo).</Text>
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 30 },
    intro: { color: t.textSoft, fontSize: 13, lineHeight: 19, marginBottom: 16 },
    label: { color: t.dim, fontSize: 12, marginBottom: 6, marginTop: 14 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      maxWidth: 220,
    },
    chipText: { color: t.textSoft, fontSize: 12.5 },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      paddingVertical: 13,
      marginTop: 18,
    },
    btnText: { fontSize: 14, fontWeight: '700' },
    linkBox: {
      backgroundColor: t.panel2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 11,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    linkText: { color: t.text, fontSize: 12.5, fontFamily: 'Courier', lineHeight: 18 },
    copy: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 11,
      paddingVertical: 11,
      marginTop: 8,
    },
    copyText: { color: t.textSoft, fontSize: 13, fontWeight: '600' },
    expiry: { color: t.warn, fontSize: 12, marginTop: 10, fontWeight: '600' },
    steps: { color: t.dim, fontSize: 11.5, lineHeight: 17, marginTop: 10 },
    note: { color: t.dimSoft, fontSize: 12, marginTop: 14 },
    error: { color: '#fca5a5', fontSize: 12, marginTop: 10 },
  });
