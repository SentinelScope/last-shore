/**
 * Weather ambience — Web Audio only.
 * Public surface: setWeatherTrack, setMuted.
 * Missing files fail silently. Unlocks on first pointerdown.
 */

import type { WeatherId } from "./balance";

const MUTE_KEY = "last-shore-audio-muted";
const CROSSFADE_SEC = 2.5;
const WEATHER_IDS: WeatherId[] = [
  "clear",
  "hot",
  "overcast",
  "rain",
  "storm",
];

type Track = {
  gain: GainNode;
  source: AudioBufferSourceNode | null;
  buffer: AudioBuffer | null;
  loading: Promise<void> | null;
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const tracks = new Map<WeatherId, Track>();
let current: WeatherId | null = null;
let muted = false;
let gestureBound = false;
let visibilityBound = false;
let wanted: WeatherId | null = null;

function readMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMuted(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function bindGestureUnlock(): void {
  if (typeof window === "undefined" || gestureBound) return;
  gestureBound = true;
  const unlock = () => {
    window.removeEventListener("pointerdown", unlock, true);
    void resumeAndApply();
  };
  window.addEventListener("pointerdown", unlock, true);
}

function bindVisibility(): void {
  if (typeof document === "undefined" || visibilityBound) return;
  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) {
      void ctx.suspend();
    } else if (!muted) {
      void resumeAndApply();
    }
  });
}

async function ensureContext(): Promise<AudioContext | null> {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    for (const id of WEATHER_IDS) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(master);
      tracks.set(id, { gain, source: null, buffer: null, loading: null });
    }
  }
  return ctx;
}

async function loadTrack(id: WeatherId): Promise<void> {
  const track = tracks.get(id);
  const audio = ctx;
  if (!track || !audio) return;
  if (track.buffer || track.loading) {
    await track.loading;
    return;
  }
  track.loading = (async () => {
    try {
      const res = await fetch(`/audio/weather/${id}.mp3`);
      if (!res.ok) return;
      const raw = await res.arrayBuffer();
      track.buffer = await audio.decodeAudioData(raw.slice(0));
    } catch {
      /* missing or decode error — stay silent */
    } finally {
      track.loading = null;
    }
  })();
  await track.loading;
}

function startSource(id: WeatherId): void {
  const audio = ctx;
  const track = tracks.get(id);
  if (!audio || !track?.buffer) return;
  if (track.source) {
    try {
      track.source.stop();
    } catch {
      /* already stopped */
    }
    track.source.disconnect();
    track.source = null;
  }
  const src = audio.createBufferSource();
  src.buffer = track.buffer;
  src.loop = true;
  src.connect(track.gain);
  try {
    src.start(0);
    track.source = src;
  } catch {
    /* ignore */
  }
}

function crossfadeTo(next: WeatherId): void {
  const audio = ctx;
  if (!audio) return;
  const now = audio.currentTime;
  const end = now + CROSSFADE_SEC;

  for (const id of WEATHER_IDS) {
    const track = tracks.get(id);
    if (!track) continue;
    const target = id === next && track.buffer ? 1 : 0;
    track.gain.gain.cancelScheduledValues(now);
    track.gain.gain.setValueAtTime(track.gain.gain.value, now);
    track.gain.gain.linearRampToValueAtTime(target, end);
    if (id === next && track.buffer && !track.source) {
      startSource(id);
    }
  }
  current = next;
}

async function resumeAndApply(): Promise<void> {
  const audio = await ensureContext();
  if (!audio) return;
  if (audio.state === "suspended") {
    try {
      await audio.resume();
    } catch {
      return;
    }
  }
  if (master) {
    master.gain.cancelScheduledValues(audio.currentTime);
    master.gain.setValueAtTime(muted || document.hidden ? 0 : 1, audio.currentTime);
  }
  if (wanted) {
    await loadTrack(wanted);
    if (wanted !== current || !tracks.get(wanted)?.source) {
      crossfadeTo(wanted);
    }
  }
}

/** Switch (or keep) the looping weather bed. Crossfades ~2.5s. */
export function setWeatherTrack(weather: WeatherId): void {
  muted = readMuted();
  wanted = weather;
  bindGestureUnlock();
  bindVisibility();
  void (async () => {
    await ensureContext();
    await loadTrack(weather);
    const audio = ctx;
    if (!audio) return;
    if (audio.state === "suspended") {
      // Wait for gesture; unlock handler will apply.
      return;
    }
    if (document.hidden || muted) {
      crossfadeTo(weather);
      if (master) master.gain.value = 0;
      return;
    }
    crossfadeTo(weather);
  })();
}

/** Persist mute and duck the master bus. */
export function setMuted(value: boolean): void {
  muted = value;
  writeMuted(value);
  bindGestureUnlock();
  bindVisibility();
  void (async () => {
    const audio = await ensureContext();
    if (!audio || !master) return;
    if (audio.state === "suspended" && !value) {
      try {
        await audio.resume();
      } catch {
        return;
      }
    }
    const now = audio.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(
      value || document.hidden ? 0 : 1,
      now + 0.2,
    );
    if (!value && wanted) {
      await loadTrack(wanted);
      if (!tracks.get(wanted)?.source) crossfadeTo(wanted);
    }
  })();
}
