import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';

import ChatView from '@/components/chat-view';
import Onboarding, { ONBOARDED_KEY } from '@/components/onboarding';
import Splash from '@/components/splash';
import { loadCreds, ping } from '@/lib/api';

const MIN_SPLASH_MS = 1100;

export default function HomeScreen() {
  const [booting, setBooting] = useState(true);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const started = Date.now();
    (async () => {
      let onboarded = false;
      try {
        onboarded = !!(await SecureStore.getItemAsync(ONBOARDED_KEY));
      } catch {
        onboarded = true;
      }
      // calienta la conexión si ya hay credenciales
      try {
        const creds = await loadCreds();
        if (creds) await ping();
      } catch {
        /* da igual */
      }
      const left = MIN_SPLASH_MS - (Date.now() - started);
      if (left > 0) await new Promise((r) => setTimeout(r, left));
      setSeen(onboarded);
      setBooting(false);
    })();
  }, []);

  if (booting) return <Splash />;
  if (!seen) return <Onboarding onDone={() => setSeen(true)} />;
  return <ChatView />;
}
