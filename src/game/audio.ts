/**
 * Game audio — Web Audio only.
 * Weather beds, night overlay, one-shot SFX.
 * Missing files fail silently. Unlocks on first pointerdown.
 */

import type { WeatherId } from "./balance";

const MUTE_KEY = "last-shore-audio-muted";
const CROSSFADE_SEC = 2.5;
const NIGHT_CROSSFADE_SEC = 2.0;
const SFX_VOLUME = 0.85;
const NIGHT_VOLUME = 0.7;

const WEATHER_IDS: WeatherId[] = [
  "clear",
  "hot",
  "overcast",
  "rain",
  "storm",
];

export type SfxId =
  | "activity_complete"
  | "build"
  | "diary"
  | "items";

const SFX_SRC: Record<SfxId, string> = {
  activity_complete: "/audio/sound%20effects/activity_complete.mp3",
  build: "/audio/sound%20effects/build.mp3",
  diary: "/audio/sound%20effects/diary.mp3",
  items: "/audio/sound%20effects/items.mp3",
};

const NIGHT_SRC = "/audio/daytime/night.mp3";

type LoopTrack = {
  gain: GainNode;
  source: AudioBufferSourceNode | null;
  buffer: AudioBuffer | null;
  loading: Promise<void> | null;
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
const weatherTracks = new Map<WeatherId, LoopTrack>();
let nightTrack: LoopTrack | null = null;
let currentWeather: WeatherId | null = null;
let nightWanted = false;
let muted = false;
let gestureBound = false;
let visibilityBound = false;
let wantedWeather: WeatherId | null = null;
const sfxBuffers = new Map<SfxId, AudioBuffer | null>();
const sfxLoading = new Map<SfxId, Promise<AudioBuffer | null>>();

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

    sfxBus = ctx.createGain();
    sfxBus.gain.value = SFX_VOLUME;
    sfxBus.connect(master);

    for (const id of WEATHER_IDS) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(master);
      weatherTracks.set(id, {
        gain,
        source: null,
        buffer: null,
        loading: null,
      });
    }

    const nightGain = ctx.createGain();
    nightGain.gain.value = 0;
    nightGain.connect(master);
    nightTrack = {
      gain: nightGain,
      source: null,
      buffer: null,
      loading: null,
    };
  }
  return ctx;
}

async function fetchBuffer(url: string): Promise<AudioBuffer | null> {
  const audio = ctx;
  if (!audio) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const raw = await res.arrayBuffer();
    return await audio.decodeAudioData(raw.slice(0));
  } catch {
    return null;
  }
}

async function loadWeather(id: WeatherId): Promise<void> {
  const track = weatherTracks.get(id);
  if (!track || !ctx) return;
  if (track.buffer || track.loading) {
    await track.loading;
    return;
  }
  track.loading = (async () => {
    track.buffer = await fetchBuffer(`/audio/weather/${id}.mp3`);
    track.loading = null;
  })();
  await track.loading;
}

async function loadNight(): Promise<void> {
  if (!nightTrack || !ctx) return;
  if (nightTrack.buffer || nightTrack.loading) {
    await nightTrack.loading;
    return;
  }
  nightTrack.loading = (async () => {
    nightTrack!.buffer = await fetchBuffer(NIGHT_SRC);
    nightTrack!.loading = null;
  })();
  await nightTrack.loading;
}

function startLoop(track: LoopTrack): void {
  const audio = ctx;
  if (!audio || !track.buffer) return;
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

function crossfadeWeather(next: WeatherId): void {
  const audio = ctx;
  if (!audio) return;
  const now = audio.currentTime;
  const end = now + CROSSFADE_SEC;

  for (const id of WEATHER_IDS) {
    const track = weatherTracks.get(id);
    if (!track) continue;
    const target = id === next && track.buffer ? 1 : 0;
    track.gain.gain.cancelScheduledValues(now);
    track.gain.gain.setValueAtTime(track.gain.gain.value, now);
    track.gain.gain.linearRampToValueAtTime(target, end);
    if (id === next && track.buffer && !track.source) {
      startLoop(track);
    }
  }
  currentWeather = next;
}

function applyNightFade(): void {
  const audio = ctx;
  const track = nightTrack;
  if (!audio || !track) return;
  const now = audio.currentTime;
  const end = now + NIGHT_CROSSFADE_SEC;
  const target = nightWanted && track.buffer ? NIGHT_VOLUME : 0;
  track.gain.gain.cancelScheduledValues(now);
  track.gain.gain.setValueAtTime(track.gain.gain.value, now);
  track.gain.gain.linearRampToValueAtTime(target, end);
  if (nightWanted && track.buffer && !track.source) {
    startLoop(track);
  }
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
    master.gain.setValueAtTime(
      muted || document.hidden ? 0 : 1,
      audio.currentTime,
    );
  }
  if (wantedWeather) {
    await loadWeather(wantedWeather);
    if (
      wantedWeather !== currentWeather ||
      !weatherTracks.get(wantedWeather)?.source
    ) {
      crossfadeWeather(wantedWeather);
    }
  }
  if (nightWanted) {
    await loadNight();
    applyNightFade();
  } else {
    applyNightFade();
  }
}

/** Switch (or keep) the looping weather bed. Crossfades ~2.5s. */
export function setWeatherTrack(weather: WeatherId): void {
  muted = readMuted();
  wantedWeather = weather;
  bindGestureUnlock();
  bindVisibility();
  void (async () => {
    await ensureContext();
    await loadWeather(weather);
    const audio = ctx;
    if (!audio) return;
    if (audio.state === "suspended") return;
    crossfadeWeather(weather);
    if (master) {
      master.gain.value = document.hidden || muted ? 0 : 1;
    }
  })();
}

/** Layer / remove the night bed over the current weather track. */
export function setNightAmbience(on: boolean): void {
  muted = readMuted();
  nightWanted = on;
  bindGestureUnlock();
  bindVisibility();
  void (async () => {
    await ensureContext();
    if (on) await loadNight();
    const audio = ctx;
    if (!audio) return;
    if (audio.state === "suspended") return;
    applyNightFade();
    if (master) {
      master.gain.value = document.hidden || muted ? 0 : 1;
    }
  })();
}

async function loadSfx(id: SfxId): Promise<AudioBuffer | null> {
  if (sfxBuffers.has(id)) return sfxBuffers.get(id) ?? null;
  const pending = sfxLoading.get(id);
  if (pending) return pending;
  const job = (async () => {
    await ensureContext();
    const buf = await fetchBuffer(SFX_SRC[id]);
    sfxBuffers.set(id, buf);
    sfxLoading.delete(id);
    return buf;
  })();
  sfxLoading.set(id, job);
  return job;
}

/** Play a one-shot UI / feedback sound. */
export function playSfx(id: SfxId): void {
  muted = readMuted();
  if (muted) return;
  bindGestureUnlock();
  bindVisibility();
  void (async () => {
    const audio = await ensureContext();
    if (!audio || !sfxBus) return;
    if (audio.state === "suspended") {
      try {
        await audio.resume();
      } catch {
        return;
      }
    }
    const buf = await loadSfx(id);
    if (!buf || muted || document.hidden) return;
    const src = audio.createBufferSource();
    src.buffer = buf;
    src.connect(sfxBus);
    try {
      src.start(0);
    } catch {
      /* ignore */
    }
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
    if (!value && wantedWeather) {
      await loadWeather(wantedWeather);
      if (!weatherTracks.get(wantedWeather)?.source) {
        crossfadeWeather(wantedWeather);
      }
    }
    if (!value && nightWanted) {
      await loadNight();
      applyNightFade();
    }
  })();
}
