import * as Clipboard from 'expo-clipboard';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Markdown from 'react-native-markdown-display';

import { haptic } from '@/lib/haptics';
import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';

const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

/** Bloque de código con cabecera y botón de copiar. */
function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const t = usePalette();
  const s = makeStyles(t);
  const [done, setDone] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(code);
    haptic('success');
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };

  return (
    <View style={s.codeCard}>
      <View style={s.codeHead}>
        <Text style={s.codeLang}>{lang && lang.trim() ? lang.trim() : 'código'}</Text>
        <Pressable onPress={copy} hitSlop={10} style={s.copyBtn}>
          <SymbolView name={done ? 'checkmark' : 'doc.on.doc'} tintColor={done ? t.ok : t.dim} size={12} />
          <Text style={[s.copyText, done && { color: t.ok }]}>{done ? 'copiado' : 'copiar'}</Text>
        </Pressable>
      </View>
      <Text style={s.codeText} selectable>
        {code.replace(/\n$/, '')}
      </Text>
    </View>
  );
}

/** Código en línea: se copia al tocarlo. */
function InlineCode({ code }: { code: string }) {
  const t = usePalette();
  const s = makeStyles(t);
  const [done, setDone] = useState(false);
  return (
    <Text
      style={[s.code_inline, done && { color: t.ok }]}
      onPress={async () => {
        await Clipboard.setStringAsync(code);
        haptic('tap');
        setDone(true);
        setTimeout(() => setDone(false), 900);
      }}>
      {code}
    </Text>
  );
}

export default function Md({ children }: { children: string }) {
  const t = usePalette();
  const styles = makeStyles(t);

  const rules = useMemo(
    () => ({
      fence: (node: { key: string; content?: string; sourceInfo?: string }) => (
        <CodeBlock key={node.key} code={node.content ?? ''} lang={node.sourceInfo} />
      ),
      code_block: (node: { key: string; content?: string }) => (
        <CodeBlock key={node.key} code={node.content ?? ''} />
      ),
      code_inline: (node: { key: string; content?: string }) => (
        <InlineCode key={node.key} code={node.content ?? ''} />
      ),
    }),
    []
  );

  return (
    <Markdown style={styles} mergeStyle={false} rules={rules as never}>
      {children}
    </Markdown>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    body: { color: t.textSoft, fontSize: 14, lineHeight: 21 },
    paragraph: { marginTop: 0, marginBottom: 8 },
    heading1: { color: t.text, fontSize: 19, fontWeight: '700', marginTop: 6, marginBottom: 6 },
    heading2: { color: t.text, fontSize: 17, fontWeight: '700', marginTop: 6, marginBottom: 6 },
    heading3: { color: t.text, fontSize: 15, fontWeight: '700', marginTop: 4, marginBottom: 4 },
    strong: { color: t.text, fontWeight: '700' },
    em: { fontStyle: 'italic' },
    link: { color: t.accent },
    blockquote: {
      backgroundColor: t.panel,
      borderLeftColor: t.line,
      borderLeftWidth: 3,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginVertical: 6,
    },
    code_inline: {
      backgroundColor: t.panel2,
      color: t.accent,
      fontFamily: mono,
      fontSize: 12.5,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 5,
    },
    fence: { marginVertical: 6 },
    code_block: { marginVertical: 6 },
    codeCard: {
      backgroundColor: t.panel,
      borderColor: t.line,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 10,
      overflow: 'hidden',
      marginVertical: 6,
    },
    codeHead: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.line,
      backgroundColor: t.panel2,
    },
    codeLang: {
      color: t.dimSoft,
      fontSize: 10.5,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      flex: 1,
    },
    copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    copyText: { color: t.dim, fontSize: 11, fontWeight: '600' },
    codeText: {
      color: t.textSoft,
      fontFamily: mono,
      fontSize: 12.5,
      paddingHorizontal: 11,
      paddingVertical: 10,
    },
    bullet_list: { marginVertical: 2 },
    ordered_list: { marginVertical: 2 },
    list_item: { marginVertical: 2 },
    hr: { backgroundColor: t.line, height: StyleSheet.hairlineWidth, marginVertical: 10 },
    table: { borderWidth: StyleSheet.hairlineWidth, borderColor: t.line, borderRadius: 8 },
    thead: { backgroundColor: t.panel },
    th: { padding: 6, color: t.text, fontWeight: '700' },
    td: { padding: 6, borderColor: t.line },
  });
