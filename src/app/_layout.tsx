import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import ToastHost from '@/components/toast';
import { PrefsProvider } from '@/lib/prefs';
import { ThemeProvider, usePalette } from '@/theme/theme';

function ThemedStack() {
  const t = usePalette();
  return (
    <>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />
      <ToastHost />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <PrefsProvider>
        <ThemedStack />
      </PrefsProvider>
    </ThemeProvider>
  );
}
