/**
 * Töne über die Web Audio API: Sinustöne werden einmal als Puffer erzeugt
 * und über AudioContext.currentTime geplant (keine Audiodateien).
 */
let ctx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();

function context(): AudioContext | null {
  if (ctx) return ctx;
  const AC = (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

function sine(c: AudioContext, freq: number, ms: number): AudioBuffer {
  const k = `${freq}-${ms}`;
  const cached = buffers.get(k);
  if (cached) return cached;
  const n = Math.round((c.sampleRate * ms) / 1000);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  const fade = Math.min(n / 4, c.sampleRate * 0.008); // 8 ms ein- und ausblenden, kein Knacken
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / fade, (n - i) / fade);
    d[i] = Math.sin((2 * Math.PI * freq * i) / c.sampleRate) * 0.35 * env;
  }
  buffers.set(k, buf);
  return buf;
}

/** Bereitet den Ton vor (nach einer Nutzeraktion aufrufen, sonst bleibt der Kontext stumm). */
export function unlockAudio(): void {
  const c = context();
  if (c && c.state === 'suspended') void c.resume();
}

/** Spielt einen Sinuston; delayMs plant ihn relativ zur Audiouhr. */
export function playTone(freq: number, ms = 250, delayMs = 0): void {
  const c = context();
  if (!c) return;
  const src = c.createBufferSource();
  src.buffer = sine(c, freq, ms);
  src.connect(c.destination);
  src.start(c.currentTime + delayMs / 1000);
}
