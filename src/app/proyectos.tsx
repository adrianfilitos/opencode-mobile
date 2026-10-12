import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Sym } from '@/components/settings-row';
import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';
import { createSession, getProjects, getSessions, shortPath, type Project, type Session } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { usePrefs } from '@/lib/prefs';

function useStyles() {
  const t = usePalette();
  return useMemo(() => makeStyles(t), [t]);
}

function when(ts?: number) {
  if (!ts) return '';
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

export default function ProyectosScreen() {
  const s = useStyles();
  const t = usePalette();
  const router = useRouter();
  const { prefs, model } = usePrefs();
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [pr, se] = await Promise.all([getProjects(), getSessions()]);
      setProjects(pr);
      setSessions(se);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function nuevo(project: Project) {
    try {
      haptic('tap');
      const ses = await createSession(project.canonical, { agent: prefs.agent, model });
      haptic('success');
      router.push({
        pathname: '/sesion/[id]',
        params: { id: ses.id, title: shortPath(project.canonical) },
      } as never);
    } catch (e) {
      haptic('error');
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <Stack.Screen options={{ title: 'Proyectos' }} />

      {loading ? <ActivityIndicator color={t.accent} style={{ marginTop: 30 }} /> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}

      {projects.map((p) => {
        const list = sessions.filter((x) => x.projectID === p.id);
        const isOpen = open === p.id;
        return (
          <View key={p.id} style={s.card}>
            <Pressable style={s.head} onPress={() => setOpen(isOpen ? null : p.id)}>
              <Sym name={isOpen ? 'folder.fill' : 'folder'} size={17} color={isOpen ? t.accent : t.dim} />
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{shortPath(p.canonical)}</Text>
                <Text style={s.sub} numberOfLines={1}>
                  {p.canonical} · {list.length} {list.length === 1 ? 'sesión' : 'sesiones'}
                </Text>
              </View>
              <Sym name={isOpen ? 'chevron.up' : 'chevron.down'} size={14} color={t.dimSoft} />
            </Pressable>

            {isOpen ? (
              <View style={s.body}>
                {list.slice(0, 15).map((ses) => (
                  <Pressable
                    key={ses.id}
                    style={s.srow}
                    onPress={() =>
                      router.push({
                        pathname: '/sesion/[id]',
                        params: { id: ses.id, title: ses.title?.trim() || shortPath(p.canonical) },
                      } as never)
                    }>
                    <Sym name="bubble.left" size={14} color={t.dim} />
                    <Text style={s.srowText} numberOfLines={1}>
                      {ses.title?.trim() || `Nueva · ${ses.id.slice(-4)}`}
                    </Text>
                    <Text style={s.srowMeta}>{when(ses.time?.updated)}</Text>
                  </Pressable>
                ))}
                {list.length === 0 ? <Text style={s.empty}>Sin sesiones todavía.</Text> : null}

                <Pressable style={s.newBtn} onPress={() => nuevo(p)}>
                  <Sym name="plus" size={14} color={t.accent} />
                  <Text style={[s.newBtnText, { color: t.accent }]}>Nueva sesión aquí</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { padding: 14, paddingBottom: 40 },
    error: { color: '#fca5a5', fontSize: 12, marginBottom: 10 },
    card: {
      backgroundColor: t.panel,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.line,
      borderRadius: 14,
      marginBottom: 10,
      overflow: 'hidden',
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    title: { color: t.text, fontSize: 14.5, fontWeight: '600' },
    sub: { color: t.dimSoft, fontSize: 11.5, marginTop: 3 },
    body: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.lineSoft, paddingHorizontal: 8 },
    srow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 11,
      paddingHorizontal: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.lineSoft,
    },
    srowText: { color: t.textSoft, fontSize: 13.5, flexShrink: 1 },
    srowMeta: { marginLeft: 'auto', color: t.dimSoft, fontSize: 11 },
    empty: { color: t.dimSoft, fontSize: 12.5, padding: 12 },
    newBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 6 },
    newBtnText: { fontSize: 13.5, fontWeight: '600' },
  });
