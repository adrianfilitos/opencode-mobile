import * as Haptics from 'expo-haptics';

/**
 * Vibración del iPhone. Se puede apagar en Ajustes → Apariencia.
 * `setHapticsEnabled` lo llama el proveedor de preferencias.
 */
let enabled = true;

export function setHapticsEnabled(v: boolean) {
  enabled = v;
}

export type HapticKind = 'tap' | 'select' | 'success' | 'error' | 'warning';

export function haptic(kind: HapticKind = 'tap') {
  if (!enabled) return;
  try {
    switch (kind) {
      case 'success':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'error':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'warning':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'select':
        void Haptics.selectionAsync();
        break;
      default:
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    /* sin vibración: no pasa nada */
  }
}
