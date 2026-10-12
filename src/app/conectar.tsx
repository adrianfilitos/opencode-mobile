import { CameraView, useCameraPermissions } from 'expo-camera';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Sym } from '@/components/settings-row';
import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';
import { baseUrlFromLink, ping, redeem, saveCreds } from '@/lib/api';

const EXAMPLE_URL = 'http://192.168.1.37:49374';

function useStyles() {
  const t = usePalette();
  return useMemo(() => makeStyles(t), [t]);
}

export default function ConectarScreen() {
  const s = useStyles();
  const t = usePalette();
  const router = useRouter();
  const [value, setValue] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<'idle' | 'pairing' | 'done'>('idle');
  const [permission, requestPermission] = useCameraPermissions();
  const lock = useRef(false);
  const scanline = useRef(new Animated.Value(0)).current;

  // línea de escaneo animada
  useEffect(() => {
    if (!scanning) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanline, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanline, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scanning, scanline]);

  async function connect(raw?: string) {
    const v = (raw ?? value).trim();
    console.log('[conectar] intento con:', v.slice(0, 80));
    setError(null);
    setBusy(true);
    setScanning(false);
    setStatus('pairing');
    try {
      if (v.includes('/auth/connect/')) {
        const base = baseUrlFromLink(v);
        console.log('[conectar] base url:', base);
        if (!base && !url.trim()) throw new Error('No reconozco la dirección del enlace');
        if (base) setUrl(base);
        const token = await redeem(v);
        console.log('[conectar] token recibido, longitud:', token.length);
        await saveCreds(base ?? url, token);
        // Aprende las demás direcciones del servidor (p. ej. Tailscale) para
        // que un cambio de IP no vuelva a romper la conexión.
        await ping().catch(() => {});
        console.log('[conectar] credenciales guardadas');
      } else if (v.length > 10) {
        if (!url.trim()) throw new Error('Escribe también la dirección del servidor');
        await saveCreds(url, v);
      } else {
        throw new Error('Pega el enlace de emparejamiento, o escanea el QR');
      }
      setStatus('done');
      await new Promise((r) => setTimeout(r, 900));
      router.replace('/');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[conectar] ERROR:', msg);
      setError(msg);
      setStatus('idle');
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }

  async function openScanner() {
    setError(null);
    if (!permission?.granted) {
      const p = await requestPermission();
      if (!p.granted) {
        setError('Necesito permiso para usar la cámara');
        return;
      }
    }
    lock.current = false;
    setScanning(true);
  }

  function onScan(data: string) {
    console.log('[conectar] QR leído:', data.slice(0, 100));
    if (lock.current) return;
    lock.current = true;
    setValue(data);
    connect(data);
  }

  if (scanning) {
    return (
      <View style={s.scanRoot}>
        <Stack.Screen options={{ title: 'Escanear QR' }} />
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => onScan(data)}
        />
        <View style={s.scanTop}>
          <Pressable hitSlop={12} onPress={() => setScanning(false)}>
            <Sym name="xmark" size={20} color="#fff" />
          </Pressable>
          <Text style={s.scanTitle}>Escanea el QR del PC</Text>
          <View style={{ width: 20 }} />
        </View>
        <View style={s.finderWrap} pointerEvents="none">
          <View style={s.finder}>
            <View style={[s.corner, s.tl, { borderColor: t.accent }]} />
            <View style={[s.corner, s.tr, { borderColor: t.accent }]} />
            <View style={[s.corner, s.bl, { borderColor: t.accent }]} />
            <View style={[s.corner, s.br, { borderColor: t.accent }]} />
            <Animated.View
              style={[
                s.scanline,
                {
                  backgroundColor: t.accent,
                  shadowColor: t.accent,
                  transform: [
                    {
                      translateY: scanline.interpolate({
                        inputRange: [0, 1],
                        outputRange: [4, 206],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>
        </View>
        <View style={s.scanBottom}>
          <Text style={s.scanHint}>Abre el QR en tu PC (opencode pair) y apúntale aquí</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Conectar' }} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.hero}>
          <View style={[s.logo, { backgroundColor: t.accent }]}>
            <Sym name="terminal" size={26} color={t.ink} />
          </View>
          <Text style={s.title}>Conecta con tu PC</Text>
          <Text style={s.sub}>
            En el PC ejecuta <Text style={[s.code, { color: t.accent }]}>opencode pair</Text> y escanea el QR.
          </Text>
        </View>

        <Pressable style={[s.scanBtn, { backgroundColor: t.accent }]} onPress={openScanner}>
          <Sym name="qrcode.viewfinder" size={18} color={t.ink} />
          <Text style={[s.scanBtnText, { color: t.ink }]}>Escanear QR</Text>
        </Pressable>

        <Text style={s.or}>o a mano</Text>

        <Text style={s.label}>Enlace de emparejamiento o token</Text>
        <TextInput
          style={s.input}
          placeholder="http://192.168.1.37:49374/auth/connect/…"
          placeholderTextColor={t.dimSoft}
          value={value}
          onChangeText={(v) => {
            setValue(v);
            // si pegas un enlace, la dirección se rellena sola
            const base = baseUrlFromLink(v);
            if (base) setUrl(base);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
        />

        <Text style={s.label}>Dirección del servidor</Text>
        <TextInput
          style={s.input}
          placeholder={EXAMPLE_URL}
          placeholderTextColor={t.dimSoft}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {error ? (
          <View style={s.errorBox}>
            <Sym name="exclamationmark.triangle.fill" size={14} color="#fca5a5" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable style={[s.cta, busy && { opacity: 0.7 }]} onPress={() => connect()} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={t.textSoft} />
          ) : (
            <>
              <Sym name="link" size={16} color={t.textSoft} />
              <Text style={s.ctaText}>Conectar</Text>
            </>
          )}
        </Pressable>
      </KeyboardAvoidingView>

      </ScrollView>

      {status !== 'idle' ? (
        <View style={s.overlay}>
          <View style={s.overlayCard}>
            {status === 'done' ? (
              <Sym name="checkmark.circle.fill" size={46} color={t.accent} />
            ) : (
              <ActivityIndicator color={t.accent} size="large" />
            )}
            <Text style={s.overlayText}>
              {status === 'done' ? '¡Vinculado!' : 'Emparejando con el PC…'}
            </Text>
            {status === 'pairing' ? (
              <Text style={s.overlaySub}>Comprobando el código con tu ordenador</Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 20 },
    hero: { alignItems: 'center', gap: 10, marginTop: 16, marginBottom: 24 },
    logo: { width: 66, height: 66, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    title: { color: t.text, fontSize: 20, fontWeight: '700' },
    sub: { color: t.dim, fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 300 },
    code: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
    scanBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      borderRadius: 13,
      paddingVertical: 15,
    },
    scanBtnText: { fontSize: 15, fontWeight: '600' },
    or: { color: t.dimSoft, fontSize: 11.5, textAlign: 'center', marginTop: 16, marginBottom: 4 },
    label: { color: t.dim, fontSize: 12, marginBottom: 6, marginTop: 14 },
    input: {
      backgroundColor: t.panel2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 11,
      paddingHorizontal: 13,
      paddingVertical: 11,
      color: t.text,
      fontSize: 13.5,
      minHeight: 46,
    },
    errorBox: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
      backgroundColor: t.warnBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.warnLine,
      borderRadius: 11,
      padding: 11,
      marginTop: 16,
    },
    errorText: { color: '#fca5a5', fontSize: 12.5, flex: 1, lineHeight: 18 },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 13,
      paddingVertical: 15,
      marginTop: 22,
    },
    ctaText: { color: t.textSoft, fontSize: 15, fontWeight: '600' },

    scanRoot: { flex: 1, backgroundColor: '#000' },
    scanTop: {
      position: 'absolute',
      top: 54,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
    },
    scanTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
    finderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    finder: { width: 230, height: 230 },
    corner: { position: 'absolute', width: 34, height: 34, borderWidth: 3 },
    tl: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 12 },
    tr: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 12 },
    bl: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 12 },
    br: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 12 },
    scanline: {
      position: 'absolute',
      left: 8,
      right: 8,
      height: 2,
      borderRadius: 2,
      shadowOpacity: 0.9,
      shadowRadius: 8,
    },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.65)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    overlayCard: {
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 18,
      paddingHorizontal: 30,
      paddingVertical: 26,
      alignItems: 'center',
      gap: 12,
      minWidth: 240,
    },
    overlayText: { color: t.text, fontSize: 16, fontWeight: '600' },
    overlaySub: { color: t.dim, fontSize: 12, textAlign: 'center' },
    scanBottom: { paddingBottom: 60, alignItems: 'center' },
    scanHint: { color: '#cfd3dd', fontSize: 12.5, textAlign: 'center', paddingHorizontal: 30 },
  });
