import { Stack, useLocalSearchParams } from 'expo-router';

import ChatView from '@/components/chat-view';

export default function SesionScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  return (
    <>
      {/* sin gesto nativo "atrás": aquí deslizar a la derecha abre el menú ☰ */}
      <Stack.Screen options={{ gestureEnabled: false }} />
      <ChatView sessionId={id} title={title} />
    </>
  );
}
