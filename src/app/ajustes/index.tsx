import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { SettingsRow } from '@/components/settings-row';
import { loadCreds } from '@/lib/api';
import { usePrefs } from '@/lib/prefs';
import type { Palette } from '@/theme/palettes';
import { usePalette } from '@/theme/theme';

function useStyles() {
  const t = usePalette();
  return useMemo(() => makeStyles(t), [t]);
}

export default function AjustesMenu() {
  const s = useStyles();
  const router = useRouter();
  const { prefs } = usePrefs();
  const [host, setHost] = useState<string | null>(null);

  useEffect(() => {
    loadCreds()
      .then((c) => setHost(c ? c.baseUrl.replace(/^https?:\/\//, '') : null))
      .catch(() => setHost(null));
  }, []);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <SettingsRow
        icon="server.rack"
        title="Servidor"
        subtitle={host ?? 'sin configurar'}
        chevron
        onPress={() => router.push('/ajustes/servidor' as never)}
      />
      <SettingsRow
        icon="cpu"
        title="Agente y modelo"
        subtitle={`${prefs.agent} · ${prefs.modelId}`}
        chevron
        onPress={() => router.push('/ajustes/modelo' as never)}
      />
      <SettingsRow
        icon="bolt"
        title="Acciones rápidas"
        subtitle={`${prefs.quickActions.length} guardadas · arriba del teclado`}
        chevron
        onPress={() => router.push('/ajustes/rapidas' as never)}
      />
      <SettingsRow
        icon="paintpalette"
        title="Apariencia"
        subtitle="Temas, color, vibración y avisos"
        chevron
        onPress={() => router.push('/ajustes/apariencia' as never)}
      />

      <Text style={s.section}>OpenCode · servidor</Text>
      <SettingsRow
        icon="key"
        title="Proveedores y claves"
        subtitle="Qué hay conectado y con qué clave"
        chevron
        onPress={() => router.push('/ajustes/proveedores' as never)}
      />
      <SettingsRow
        icon="link"
        title="Integraciones"
        subtitle="Buscar y añadir claves (300+)"
        chevron
        onPress={() => router.push('/ajustes/integraciones' as never)}
      />
      <SettingsRow
        icon="person.2"
        title="Agentes"
        subtitle="Cuáles hay y sus reglas de permisos"
        chevron
        onPress={() => router.push('/ajustes/agentes' as never)}
      />
      <SettingsRow
        icon="cpu"
        title="Modelo por defecto"
        subtitle="El que usa el servidor si no se indica otro"
        chevron
        onPress={() => router.push('/ajustes/modelo-defecto' as never)}
      />
      <SettingsRow
        icon="server.rack"
        title="MCP"
        subtitle="Servidores, conectar y desconectar"
        chevron
        onPress={() => router.push('/ajustes/mcp' as never)}
      />
      <SettingsRow
        icon="magnifyingglass"
        title="Búsqueda web"
        subtitle="Proveedores disponibles"
        chevron
        onPress={() => router.push('/ajustes/busqueda' as never)}
      />
      <SettingsRow
        icon="sparkles"
        title="Skills y comandos"
        subtitle="Lo que ofrece el servidor (solo lectura)"
        chevron
        onPress={() => router.push('/ajustes/skills' as never)}
      />
      <SettingsRow
        icon="puzzlepiece.extension"
        title="Plugins"
        subtitle="Buscar y aplicar actualizaciones"
        chevron
        onPress={() => router.push('/ajustes/plugins' as never)}
      />
      <SettingsRow
        icon="checkmark.shield"
        title="Permisos guardados"
        subtitle="Reglas «Siempre» que puedes revocar"
        chevron
        onPress={() => router.push('/ajustes/permisos' as never)}
      />
      <SettingsRow
        icon="gearshape"
        title="Configuración"
        subtitle="De dónde lee la config el servidor"
        chevron
        onPress={() => router.push('/ajustes/configuracion' as never)}
      />
      <SettingsRow
        icon="qrcode"
        title="Emparejar"
        subtitle="Generar un código para otro dispositivo"
        chevron
        onPress={() => router.push('/ajustes/emparejar' as never)}
      />

      <Text style={s.section}>App</Text>
      <SettingsRow
        icon="info.circle"
        title="Acerca de"
        subtitle="OpenCode Mobile 1.0"
        chevron
        last
        onPress={() => router.push('/ajustes/acerca' as never)}
      />
    </ScrollView>
  );
}

const makeStyles = (t: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.bg },
    content: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 24 },
    section: {
      color: t.dimSoft,
      fontSize: 11.5,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginTop: 22,
      marginBottom: 4,
      paddingHorizontal: 2,
    },
  });
