import { Stack } from 'expo-router';
import { usePalette } from '@/theme/theme';

export default function AjustesLayout() {
  const t = usePalette();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTitleStyle: { color: t.text, fontSize: 16 },
        headerTintColor: t.dim,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: t.bg },
        headerBackButtonDisplayMode: 'minimal',
      }}
    />
  );
}
