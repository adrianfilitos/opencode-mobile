import * as Haptics from 'expo-haptics';

/**
 * Vibración «de escritura»: mientras el agente va soltando texto, el iPhone da
 * toques ligeros. La frecuencia sube con la velocidad de la respuesta: cuantos
 * más caracteres por segundo, más seguidos van los toques (como en ChatGPT).
 *
 * iOS no permite una vibración continua con intensidad variable, así que se
 * imita con toques muy cortos y seguidos (el motor háptico los funde en una
 * sensación de "zumbido" cuando van rápidos).
 */

let enabled = false;
let firing = false;
let lastFire = 0;
let winStart = 0;
let winChars = 0;
/** Caracteres por segundo (suavizado). */
let rate = 0;

/** Lo llaman las preferencias (vibración general + vibración al escribir). */
export function setTypingHapticsEnabled(v: boolean) {
  enabled = v;
  if (!v) resetTypingHaptics();
}

/** Al empezar y al terminar una respuesta. */
export function resetTypingHaptics() {
  winStart = 0;
  winChars = 0;
  rate = 0;
  lastFire = 0;
}

/** Llega un trozo de texto del agente (`chars` = longitud del trozo). */
export function feedTyping(chars: number) {
  if (!enabled || chars <= 0) return;
  const now = Date.now();

  if (winStart === 0) {
    winStart = now;
    winChars = 0;
  }
  winChars += chars;

  // La velocidad se recalcula cada 400 ms, suavizada para que no dé tirones.
  const elapsed = now - winStart;
  if (elapsed >= 400) {
    const measured = (winChars / elapsed) * 1000;
    rate = rate === 0 ? measured : rate * 0.55 + measured * 0.45;
    winStart = now;
    winChars = 0;
  }

  // Intervalo entre toques: ~320 ms si va lento → ~60 ms si va rápido.
  const interval = Math.max(60, Math.min(320, 1000 / (2 + rate / 6)));
  // Un solo toque en vuelo: si el motor aún está respondiendo, no se acumulan.
  if (now - lastFire < interval || firing) return;
  lastFire = now;
  firing = true;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    .catch(() => {})
    .finally(() => {
      firing = false;
    });
}
