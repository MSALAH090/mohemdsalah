// Lightweight WebAudio synth — no external assets needed.
let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ac();
}

export function setMuted(value: boolean) {
  muted = value;
  if (typeof window !== "undefined") localStorage.setItem("ufa-muted", value ? "1" : "0");
}

export function isMuted() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("ufa-muted") === "1";
}

interface ToneOpts {
  freq: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slideTo?: number;
}

function tone({ freq, dur = 0.16, type = "sine", gain = 0.18, delay = 0, slideTo }: ToneOpts) {
  const a = ac();
  if (!a || muted) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur = 0.5, gain = 0.12, delay = 0) {
  const a = ac();
  if (!a || muted) return;
  const frames = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, frames, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = a.createBufferSource();
  src.buffer = buf;
  const g = a.createGain();
  g.gain.value = gain;
  const f = a.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 1400;
  src.connect(f).connect(g).connect(a.destination);
  src.start(a.currentTime + delay);
}

export const sfx = {
  refresh() {
    muted = isMuted();
  },
  tick() {
    tone({ freq: 1200, dur: 0.05, type: "square", gain: 0.09 });
  },
  urgentTick() {
    tone({ freq: 1650, dur: 0.07, type: "square", gain: 0.16 });
  },
  click() {
    tone({ freq: 620, dur: 0.06, type: "triangle", gain: 0.12 });
  },
  bid() {
    tone({ freq: 420, dur: 0.1, type: "triangle", gain: 0.16 });
    tone({ freq: 700, dur: 0.14, type: "triangle", gain: 0.14, delay: 0.08 });
  },
  whistle() {
    tone({ freq: 2100, dur: 0.28, type: "square", gain: 0.1, slideTo: 2500 });
    noise(0.25, 0.05);
  },
  reveal() {
    [520, 660, 780, 990].forEach((f, i) =>
      tone({ freq: f, dur: 0.22, type: "sawtooth", gain: 0.1, delay: i * 0.08 }),
    );
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) =>
      tone({ freq: f, dur: 0.3, type: "triangle", gain: 0.18, delay: i * 0.11 }),
    );
  },
  lose() {
    [420, 350, 260].forEach((f, i) =>
      tone({ freq: f, dur: 0.32, type: "sawtooth", gain: 0.13, delay: i * 0.14 }),
    );
  },
  goal() {
    noise(0.9, 0.14);
    [660, 880, 1170].forEach((f, i) =>
      tone({ freq: f, dur: 0.35, type: "square", gain: 0.15, delay: i * 0.1 }),
    );
  },
  crowd() {
    noise(1.4, 0.06);
  },
  boxRattle() {
    [240, 320, 420, 560, 720].forEach((f, i) =>
      tone({ freq: f, dur: 0.06, type: "square", gain: 0.12, delay: i * 0.07 })
    );
  },
  explosion() {
    noise(1.2, 0.35);
    tone({ freq: 160, dur: 0.7, type: "sawtooth", gain: 0.3, slideTo: 30 });
    tone({ freq: 80, dur: 0.9, type: "triangle", gain: 0.4, slideTo: 20 });
    [880, 660, 440].forEach((f, i) =>
      tone({ freq: f, dur: 0.15, type: "square", gain: 0.12, delay: i * 0.05 })
    );
  },
  jackpot() {
    [523, 659, 784, 1046, 1318, 1568].forEach((f, i) =>
      tone({ freq: f, dur: 0.35, type: "triangle", gain: 0.22, delay: i * 0.09 })
    );
  },
  curse() {
    tone({ freq: 220, dur: 0.6, type: "sawtooth", gain: 0.25, slideTo: 80 });
    tone({ freq: 207, dur: 0.6, type: "square", gain: 0.18, slideTo: 75, delay: 0.05 });
    noise(0.5, 0.15);
  },
};
