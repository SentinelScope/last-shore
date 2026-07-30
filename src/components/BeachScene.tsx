"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  activityChipLabel,
  clearPendingResults,
  canStartActivity,
  formatRemaining,
  startActivity,
  startCraft,
} from "@/game/activities";
import {
  ACTIVITY_LABEL,
  DAY_PART_LABEL,
  HOTSPOT_ACTIVITY,
  HOTSPOT_IDLE_MS,
  WEATHER_LABEL,
  type ActivityKind,
  type DurationId,
  type RecipeId,
} from "@/game/balance";
import { beachContainerAt, containerTitle } from "@/game/containers";
import { HOTSPOTS, type HotspotId } from "@/game/hotspots";
import { ITEMS } from "@/game/items";
import { placeLoot } from "@/game/inventory";
import {
  clearSave,
  createNewRun,
  loadOrCreate,
  writeSave,
  type SaveState,
} from "@/game/persist";
import { poseFor } from "@/game/pose";
import { dayNumber, dayPartAt } from "@/game/time";
import {
  catchUp,
  computeComfort,
  destroyItem,
  eatItem,
  loadMeta,
  recordBestDays,
  type DeathInfo,
} from "@/game/vitals";
import {
  currentWaterFill,
  drinkFromWater,
  placeWaterContainer,
  waterFillLabel,
} from "@/game/water";
import { setMuted, setWeatherTrack } from "@/game/audio";
import { weatherAt } from "@/game/weather";
import { BeachCrate } from "./BeachCrate";
import { ContainerPanel } from "./ContainerPanel";
import { CraftSheet } from "./CraftSheet";
import { DiarySheet } from "./DiarySheet";
import { DurationPicker } from "./DurationPicker";
import { EndingScreen } from "./EndingScreen";
import { FireplaceScreen } from "./FireplaceScreen";
import { ItemsSheet } from "./ItemsSheet";
import { ResultsPanel } from "./ResultsPanel";
import { WorldScene, type WorldSceneProps } from "./WorldScene";
import { YouSheet } from "./YouSheet";
import "@/scene/scene.css";

const AUDIO_MUTE_KEY = "last-shore-audio-muted";

function readAudioMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(AUDIO_MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function Vital({
  label,
  value,
  kind,
}: {
  label: string;
  value: number;
  kind: "w" | "f" | "h" | "c";
}) {
  const empty = value <= 0;
  return (
    <div className={`vital ${kind}${empty ? " empty" : ""}`}>
      <div className="track">
        <div className="fill" style={{ height: `${Math.round(value)}%` }} />
      </div>
      <span>{label}</span>
    </div>
  );
}

function deriveSceneProps(save: SaveState, now: number): WorldSceneProps {
  const dayPart = dayPartAt(now);
  const weather = weatherAt(save.seed, save.runStartedAt, now);
  const pose = poseFor(dayPart, weather);
  const hasWater = !!save.waterSpot.itemId;
  const waterLevel = hasWater
    ? Math.round(currentWaterFill(save, now))
    : 0;
  return {
    dayPart,
    weather,
    pose,
    fireLit: save.fireplace.lit,
    hasFireplace: save.fireplace.built !== "none",
    hasShelter: save.shelterTier !== "none",
    hasWater,
    waterLevel,
  };
}

function scenePropsEqual(a: WorldSceneProps, b: WorldSceneProps): boolean {
  return (
    a.dayPart === b.dayPart &&
    a.weather === b.weather &&
    a.pose === b.pose &&
    a.fireLit === b.fireLit &&
    a.hasFireplace === b.hasFireplace &&
    a.hasShelter === b.hasShelter &&
    a.hasWater === b.hasWater &&
    a.waterLevel === b.waterLevel
  );
}

export function BeachScene() {
  const [save, setSave] = useState<SaveState | null>(null);
  const [now, setNow] = useState(0);
  const [sceneProps, setSceneProps] = useState<WorldSceneProps | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [openSpot, setOpenSpot] = useState<HotspotId | null>(null);
  const [pickerKind, setPickerKind] = useState<ActivityKind | null>(null);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [craftOpen, setCraftOpen] = useState(false);
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [youOpen, setYouOpen] = useState(false);
  const [containerOpen, setContainerOpen] = useState(false);
  const [fireplaceOpen, setFireplaceOpen] = useState(false);
  const [ending, setEnding] = useState<DeathInfo | null>(null);
  const [bestDays, setBestDays] = useState(0);
  const [audioMuted, setAudioMuted] = useState(false);
  const idleRef = useRef<number | null>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<SaveState | null>(null);
  const weatherTrackRef = useRef<string | null>(null);

  function commitSave(next: SaveState, tick = Date.now()) {
    const weather = weatherAt(next.seed, next.runStartedAt, tick);
    const refreshed = {
      ...next,
      comfort: computeComfort(next, weather),
    };
    saveRef.current = refreshed;
    writeSave(refreshed);
    setSave(refreshed);
    setNow(tick);
    setSceneProps((prev) => {
      const nextProps = deriveSceneProps(refreshed, tick);
      if (prev && scenePropsEqual(prev, nextProps)) return prev;
      return nextProps;
    });
  }

  function handleDeath(death: DeathInfo) {
    const meta = recordBestDays(death.days);
    setBestDays(meta.bestDays);
    setEnding(death);
    saveRef.current = null;
    clearSave();
  }

  useEffect(() => {
    const t = Date.now();
    setBestDays(loadMeta().bestDays);
    const loaded = loadOrCreate(t);
    const { state, death } = catchUp(loaded, t);
    if (death) {
      handleDeath(death);
      setSave(null);
      setSceneProps(null);
    } else {
      commitSave(state, t);
    }

    const id = window.setInterval(() => {
      const tick = Date.now();
      const prev = saveRef.current;
      if (!prev) {
        setNow(tick);
        return;
      }
      const { state: next, death: died } = catchUp(prev, tick);
      if (died) {
        queueMicrotask(() => handleDeath(died));
        saveRef.current = null;
        setSave(null);
        setSceneProps(null);
        return;
      }
      saveRef.current = next;
      writeSave(next);

      // Vitals / HUD clock — allowed to tick every second.
      setSave(next);
      setNow(tick);

      // Scene appearance — only push a new props object when something visible changed.
      setSceneProps((prevProps) => {
        const nextProps = deriveSceneProps(next, tick);
        if (prevProps && scenePropsEqual(prevProps, nextProps)) return prevProps;
        return nextProps;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setAudioMuted(readAudioMuted());
    setMuted(readAudioMuted());
  }, []);

  useEffect(() => {
    if (!sceneProps) return;
    if (weatherTrackRef.current === sceneProps.weather) return;
    weatherTrackRef.current = sceneProps.weather;
    setWeatherTrack(sceneProps.weather);
  }, [sceneProps]);

  const hideHotspots = useCallback(() => {
    setRevealed(false);
    setOpenSpot(null);
    setPickerKind(null);
  }, []);

  const reveal = useCallback(() => {
    setRevealed(true);
    if (idleRef.current) window.clearTimeout(idleRef.current);
    idleRef.current = window.setTimeout(hideHotspots, HOTSPOT_IDLE_MS);
  }, [hideHotspots]);

  useEffect(() => {
    return () => {
      if (idleRef.current) window.clearTimeout(idleRef.current);
    };
  }, []);

  const view = useMemo(() => {
    if (!save || !now) return null;
    const dayPart = dayPartAt(now);
    const weather = weatherAt(save.seed, save.runStartedAt, now);
    const pose = poseFor(dayPart, weather);
    const day = dayNumber(save.runStartedAt, now);
    const beach = beachContainerAt(
      save.seed,
      save.runStartedAt,
      now,
      save.collectedTickIndex,
    );
    return { dayPart, weather, pose, day, beach };
  }, [save, now]);

  const openHotspot = openSpot
    ? (HOTSPOTS.find((h) => h.id === openSpot) ?? null)
    : null;

  function startNewRun() {
    const t = Date.now();
    const fresh = createNewRun(t);
    setEnding(null);
    commitSave(fresh, t);
    setItemsOpen(false);
    setCraftOpen(false);
    setFireplaceOpen(false);
    setContainerOpen(false);
    setOpenSpot(null);
    setRevealed(false);
  }

  if (ending) {
    return (
      <div className="phone" ref={phoneRef}>
        <WorldScene
          dayPart="night"
          weather="clear"
          pose="hut"
          fireLit={false}
          hasFireplace={false}
          hasShelter={false}
          hasWater={false}
          waterLevel={0}
        />
        <div className="vignette" />
        <EndingScreen
          days={ending.days}
          line={ending.line}
          bestDays={bestDays}
          onNewRun={startNewRun}
        />
      </div>
    );
  }

  if (!save || !view || !sceneProps) {
    return <div className="phone" aria-busy="true" />;
  }

  const sub = `${DAY_PART_LABEL[view.dayPart]} · ${WEATHER_LABEL[view.weather]}`;
  const busy = !!save.activity;
  const spotActivity = openSpot
    ? (HOTSPOT_ACTIVITY[openSpot] ?? null)
    : null;

  function onPhonePointer() {
    if (
      itemsOpen ||
      craftOpen ||
      diaryOpen ||
      youOpen ||
      fireplaceOpen ||
      save?.pendingResults ||
      containerOpen
    ) {
      return;
    }
    reveal();
  }

  function onSpotClick(id: HotspotId, e: React.MouseEvent) {
    e.stopPropagation();
    reveal();
    setPickerKind(null);

    if (id === "fire" && save?.fireplace.built !== "none") {
      setFireplaceOpen(true);
      setOpenSpot(null);
      setRevealed(false);
      if (idleRef.current) window.clearTimeout(idleRef.current);
      return;
    }

    if (id === "water" && save?.waterSpot.itemId) {
      setOpenSpot((cur) => (cur === id ? null : id));
      return;
    }

    setOpenSpot((cur) => (cur === id ? null : id));
  }

  function onActionClick(e: React.MouseEvent) {
    e.stopPropagation();
    reveal();
    if (!openSpot || !save) return;

    if (openSpot === "fire" && save.fireplace.built === "none") {
      setCraftOpen(true);
      setOpenSpot(null);
      setRevealed(false);
      if (idleRef.current) window.clearTimeout(idleRef.current);
      return;
    }

    if (openSpot === "water" && save.waterSpot.itemId) {
      const next = drinkFromWater(save, Date.now());
      commitSave(next);
      return;
    }

    if (!spotActivity) return;
    if (busy && save.activity) return;

    const gate = canStartActivity(save, spotActivity);
    if (!gate.ok) {
      setPickerKind(spotActivity);
      return;
    }
    setPickerKind(spotActivity);
  }

  function onPickDuration(durationId: DurationId) {
    if (!save || !pickerKind || pickerKind === "craft" || pickerKind === "cook")
      return;
    const next = startActivity(save, pickerKind, durationId, Date.now());
    commitSave(next);
    setPickerKind(null);
    setOpenSpot(null);
    reveal();
  }

  function dismissResults() {
    if (!save) return;
    commitSave(clearPendingResults(save));
  }

  function openContainer() {
    setContainerOpen(true);
    setOpenSpot(null);
    setPickerKind(null);
  }

  function takeContainer() {
    if (!save || !view?.beach) return;
    const beach = view.beach;
    const { inventory, kept, lost } = placeLoot(
      save.inventory,
      save.storageTier,
      beach.contents,
    );
    commitSave({
      ...save,
      inventory,
      collectedTickIndex: beach.tickIndex,
      pendingResults: {
        title: containerTitle(beach.tier),
        kept,
        lost,
        resolvedAt: Date.now(),
      },
    });
    setContainerOpen(false);
  }

  function openItems(e: React.MouseEvent) {
    e.stopPropagation();
    setItemsOpen(true);
    setCraftOpen(false);
    setDiaryOpen(false);
    setYouOpen(false);
    setFireplaceOpen(false);
    setOpenSpot(null);
    setPickerKind(null);
    setContainerOpen(false);
    setRevealed(false);
    if (idleRef.current) window.clearTimeout(idleRef.current);
  }

  function openCraft(e: React.MouseEvent) {
    e.stopPropagation();
    setCraftOpen(true);
    setItemsOpen(false);
    setDiaryOpen(false);
    setYouOpen(false);
    setFireplaceOpen(false);
    setOpenSpot(null);
    setPickerKind(null);
    setContainerOpen(false);
    setRevealed(false);
    if (idleRef.current) window.clearTimeout(idleRef.current);
  }

  function openDiary(e: React.MouseEvent) {
    e.stopPropagation();
    setDiaryOpen(true);
    setItemsOpen(false);
    setCraftOpen(false);
    setYouOpen(false);
    setFireplaceOpen(false);
    setOpenSpot(null);
    setPickerKind(null);
    setContainerOpen(false);
    setRevealed(false);
    if (idleRef.current) window.clearTimeout(idleRef.current);
  }

  function openYou(e: React.MouseEvent) {
    e.stopPropagation();
    setYouOpen(true);
    setItemsOpen(false);
    setCraftOpen(false);
    setDiaryOpen(false);
    setFireplaceOpen(false);
    setOpenSpot(null);
    setPickerKind(null);
    setContainerOpen(false);
    setRevealed(false);
    if (idleRef.current) window.clearTimeout(idleRef.current);
  }

  function onCraft(recipeId: RecipeId) {
    if (!save) return;
    const next = startCraft(save, recipeId, Date.now());
    commitSave(next);
    setCraftOpen(false);
  }

  function setOutside(inventoryIndex: number) {
    if (!save) return;
    const slot = save.inventory[inventoryIndex];
    if (!slot) return;
    const next = placeWaterContainer(
      save,
      slot.itemId,
      inventoryIndex,
      Date.now(),
    );
    if (!next) return;
    commitSave(next);
    setItemsOpen(false);
  }

  function onEat(inventoryIndex: number) {
    if (!save) return;
    const next = eatItem(save, inventoryIndex);
    if (!next) return;
    commitSave(next);
  }

  function onDestroy(inventoryIndex: number, qty: number) {
    if (!save) return;
    const next = destroyItem(save, inventoryIndex, qty);
    if (!next) return;
    commitSave(next);
  }

  function onWaterDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!save) return;
    const raw = e.dataTransfer.getData("application/x-last-shore-water");
    if (raw === "") return;
    const index = Number(raw);
    if (Number.isNaN(index)) return;
    setOutside(index);
  }

  let captionTitle = openHotspot?.title ?? "";
  let captionBody = openHotspot?.description ?? "";
  let captionAction: string | null = openHotspot?.action ?? null;
  let showAction = true;

  if (openHotspot?.id === "fire") {
    if (save.fireplace.built !== "none") {
      captionTitle = "Fireplace";
      captionBody = save.fireplace.lit
        ? "The fire is lit. Tap again to tend it."
        : "Built. Cold until you light it.";
      showAction = false;
      captionAction = null;
    } else {
      captionBody =
        "A ring of stones waiting. Craft a Simple Fireplace to place it.";
      captionAction = "Build";
    }
  } else if (openHotspot?.id === "water") {
    if (save.waterSpot.itemId) {
      const def = ITEMS[save.waterSpot.itemId];
      const fill = currentWaterFill(save, now);
      captionTitle = def?.name ?? "Water";
      captionBody = `${waterFillLabel(fill, save.waterSpot.itemId)}. Rain fills it slowly; a storm fills it fast.`;
      captionAction = fill > 0 ? "Drink" : null;
      showAction = !!captionAction;
    } else {
      captionBody =
        "Nothing set out. Drag a cup here from Items, or use Set outside.";
      showAction = false;
      captionAction = null;
    }
  } else if (openHotspot && busy && save.activity) {
    captionTitle = openHotspot.title;
    captionBody = `You're already ${ACTIVITY_LABEL[save.activity.kind].toLowerCase()}.`;
    if (save.activity.kind !== "craft" && save.activity.kind !== "cook") {
      captionBody =
        spotActivity && save.activity.kind === spotActivity
          ? `${ACTIVITY_LABEL[save.activity.kind]} — ${formatRemaining(save.activity.endsAt, now)} left.`
          : captionBody;
    } else {
      captionBody = activityChipLabel(save.activity, now);
    }
    showAction = false;
    captionAction = null;
  } else if (openHotspot && spotActivity) {
    const gate = canStartActivity(save, spotActivity);
    if (!gate.ok && !busy) {
      captionBody = gate.reason;
      showAction = false;
    }
  } else if (openHotspot && !spotActivity) {
    showAction = !!openHotspot.action;
  }

  const pickerBlocked =
    pickerKind && save && pickerKind !== "craft" && pickerKind !== "cook"
      ? (() => {
          const g = canStartActivity(save, pickerKind);
          return g.ok ? null : g.reason;
        })()
      : null;

  return (
    <div className="phone" ref={phoneRef} onClick={onPhonePointer}>
      <WorldScene {...sceneProps} />

      <svg className="grain" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        <filter id="n">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" />
        </filter>
        <rect width="100%" height="100%" filter="url(#n)" />
      </svg>
      <div className="vignette" />

      {view.beach && (
        <BeachCrate container={view.beach} onOpen={openContainer} />
      )}

      <div
        className={`water-drop${itemsOpen ? " active" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={onWaterDrop}
      />

      <div className={`hud${revealed ? " reveal" : ""}`}>
        <div className="stamp">
          <div className="day">Day {view.day}</div>
          <div className="sub">{sub}</div>
          {save.activity && (
            <div className="activity-chip">
              {activityChipLabel(save.activity, now)}
            </div>
          )}
        </div>

        <div className="vitals">
          <Vital label="W" value={save.thirst} kind="w" />
          <Vital label="F" value={save.hunger} kind="f" />
          <Vital label="H" value={save.health} kind="h" />
          <Vital label="C" value={save.comfort} kind="c" />
          <button
            type="button"
            className={`mute-tog${audioMuted ? " off" : ""}`}
            aria-label={audioMuted ? "Unmute weather" : "Mute weather"}
            aria-pressed={audioMuted}
            onClick={(e) => {
              e.stopPropagation();
              const next = !audioMuted;
              setAudioMuted(next);
              setMuted(next);
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              {audioMuted ? (
                <>
                  <path d="M4 10v4h3l4 3V7L7 10H4z" />
                  <path d="M16 9l5 5M21 9l-5 5" />
                </>
              ) : (
                <>
                  <path d="M4 10v4h3l4 3V7L7 10H4z" />
                  <path d="M15 9.5a3.5 3.5 0 010 5" />
                  <path d="M17.5 7a6 6 0 010 10" />
                </>
              )}
            </svg>
          </button>
        </div>

        {HOTSPOTS.map((h) => (
          <button
            key={h.id}
            type="button"
            className={`spot ${h.className}`}
            aria-label={h.title}
            onClick={(e) => onSpotClick(h.id, e)}
          />
        ))}

        <div
          className={`caption${openHotspot && !pickerKind ? " on" : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          <h2>{captionTitle}</h2>
          <p>{captionBody}</p>
          {showAction && captionAction ? (
            <button type="button" className="act" onClick={onActionClick}>
              {captionAction}
            </button>
          ) : null}
        </div>

        <DurationPicker
          open={
            !!pickerKind && pickerKind !== "craft" && pickerKind !== "cook"
          }
          kind={
            pickerKind === "craft" || pickerKind === "cook" ? null : pickerKind
          }
          weather={view.weather}
          blockedReason={pickerBlocked}
          onPick={onPickDuration}
          onClose={() => setPickerKind(null)}
        />

        <nav className="dock" aria-label="Dock">
          <button type="button" className="tool" onClick={openDiary}>
            <svg viewBox="0 0 24 24">
              <path d="M5 4h11l3 3v13H5z" />
              <path d="M9 9h6M9 13h6M9 17h4" />
            </svg>
            <em>Diary</em>
          </button>
          <button type="button" className="tool" onClick={openItems}>
            <svg viewBox="0 0 24 24">
              <path d="M3 8l9-4 9 4v8l-9 4-9-4z" />
              <path d="M3 8l9 4 9-4M12 12v8" />
            </svg>
            <em>Items</em>
            {save.inventory.length > 0 && <i />}
          </button>
          <button type="button" className="tool" onClick={openCraft}>
            <svg viewBox="0 0 24 24">
              <path d="M4 20l8-16 8 16z" />
              <path d="M8 20l4-8 4 8" />
            </svg>
            <em>Build</em>
          </button>
          <button type="button" className="tool" onClick={openYou}>
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="4" />
              <path d="M5 20c1-4 4-6 7-6s6 2 7 6" />
            </svg>
            <em>You</em>
          </button>
        </nav>
      </div>

      <DiarySheet
        open={diaryOpen}
        onClose={() => setDiaryOpen(false)}
        onOpened={() => {
          // Hook for page-flip SFX once audio (item 8) is in.
        }}
      />

      <YouSheet
        open={youOpen}
        save={save}
        weather={view.weather}
        onClose={() => setYouOpen(false)}
      />

      <ItemsSheet
        open={itemsOpen}
        inventory={save.inventory}
        storageTier={save.storageTier}
        onClose={() => setItemsOpen(false)}
        onSetOutside={setOutside}
        onEat={onEat}
        onDestroy={onDestroy}
      />

      <CraftSheet
        open={craftOpen}
        save={save}
        onClose={() => setCraftOpen(false)}
        onCraft={onCraft}
      />

      <FireplaceScreen
        open={fireplaceOpen}
        save={save}
        now={now}
        onClose={() => setFireplaceOpen(false)}
        onChange={(next) => {
          const { state, death } = catchUp(next, Date.now());
          if (death) {
            handleDeath(death);
            setSave(null);
            setFireplaceOpen(false);
            return;
          }
          commitSave(state);
        }}
      />

      <ResultsPanel
        results={save.pendingResults}
        onDismiss={dismissResults}
      />

      <ContainerPanel
        container={view.beach}
        open={containerOpen}
        onClose={() => setContainerOpen(false)}
        onTake={takeContainer}
      />
    </div>
  );
}
