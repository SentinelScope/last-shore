"use client";

import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import {
  activityChipLabel,
  clearPendingResults,
  canStartActivity,
  formatRemaining,
  startActivity,
  startCraft,
} from "@/game/activities";
import {
  wearClothing,
  unequipClothing,
  type ClothingSlotId,
} from "@/game/clothing";
import { cureAilmentWithItem, tickAilmentExpiry } from "@/game/ailments";
import {
  ACTIVITY_LABEL,
  DAY_PART_LABEL,
  HOTSPOT_ACTIVITY,
  HOTSPOT_IDLE_MS,
  WEATHER_LABEL,
  storageSlotCount,
  type ActivityKind,
  type DurationId,
  type RecipeId,
} from "@/game/balance";
import { beachContainerAt, containerTitle } from "@/game/containers";
import { writeContainerDiary } from "@/game/diary";
import { HOTSPOTS, type HotspotId } from "@/game/hotspots";
import { ITEMS } from "@/game/items";
import { hasItem, placeLoot } from "@/game/inventory";
import { confirmOverflow, lootFits, makeOverflow } from "@/game/overflow";
import {
  clearSave,
  createNewRun,
  loadOrCreate,
  writeSave,
  type SaveState,
} from "@/game/persist";
import { poseFor } from "@/game/pose";
import { STORAGE_TIER_NAME } from "@/game/storageArt";
import {
  isWaterVesselId,
  waterSpotCaption,
} from "@/game/waterArt";
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
import {
  playSfx,
  setFireplaceBurning,
  setFireplaceProximity,
  setMuted,
  setNightAmbience,
  setWeatherTrack,
} from "@/game/audio";
import { weatherAt } from "@/game/weather";
import { BeachCrate } from "./BeachCrate";
import { ContainerPanel } from "./ContainerPanel";
import { CraftSheet } from "./CraftSheet";
import { DiarySheet } from "./DiarySheet";
import { DurationPicker } from "./DurationPicker";
import { EndingScreen } from "./EndingScreen";
import { FireplaceScreen } from "./FireplaceScreen";
import { CompassHud, WristwatchHud } from "./HudTrinkets";
import { ItemsSheet } from "./ItemsSheet";
import { OverflowScreen } from "./OverflowScreen";
import { OmenWarning } from "./OmenWarning";
import { DropTarget, PointerDragProvider } from "./pointerDrag";
import { ResultsPanel } from "./ResultsPanel";
import { ShelterScreen } from "./ShelterScreen";
import { WorldScene, DEFAULT_SCENE_PROPS, type WorldSceneProps } from "./WorldScene";
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

/** Isolated so 1 Hz HUD ticks don't recreate SVG turbulence. */
const GrainOverlay = memo(function GrainOverlay() {
  return (
    <svg className="grain" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <filter id="n">
        <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" />
      </filter>
      <rect width="100%" height="100%" filter="url(#n)" />
    </svg>
  );
});

function deriveSceneProps(save: SaveState, now: number): WorldSceneProps {
  const dayPart = dayPartAt(now);
  const weather = weatherAt(save.seed, save.runStartedAt, now);
  const pose = poseFor(dayPart, weather);
  const hasWater = !!save.waterSpot.itemId;
  const waterLevel = hasWater
    ? Math.round(currentWaterFill(save, now) / 5) * 5
    : 0;
  return {
    dayPart,
    weather,
    pose,
    fireLit: save.fireplace.lit,
    hasFireplace: save.fireplace.built !== "none",
    fireplaceTier:
      save.fireplace.built === "stone" || save.fireplace.built === "cooking"
        ? save.fireplace.built
        : "simple",
    storageTier: save.storageTier,
    hasShelter: save.shelterTier !== "none",
    hasWater,
    waterItemId: save.waterSpot.itemId,
    waterLevel,
    figureVisible: !save.activity,
  };
}

function scenePropsEqual(a: WorldSceneProps, b: WorldSceneProps): boolean {
  return (
    a.dayPart === b.dayPart &&
    a.weather === b.weather &&
    a.pose === b.pose &&
    a.fireLit === b.fireLit &&
    a.hasFireplace === b.hasFireplace &&
    a.fireplaceTier === b.fireplaceTier &&
    a.storageTier === b.storageTier &&
    a.hasShelter === b.hasShelter &&
    a.hasWater === b.hasWater &&
    a.waterItemId === b.waterItemId &&
    a.waterLevel === b.waterLevel &&
    a.figureVisible === b.figureVisible
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
  const [shelterOpen, setShelterOpen] = useState(false);
  const [ending, setEnding] = useState<DeathInfo | null>(null);
  const [omenConfirm, setOmenConfirm] = useState<{
    kind: "scour" | "cut";
    durationId: DurationId;
  } | null>(null);
  const [bestDays, setBestDays] = useState(0);
  const [audioMuted, setAudioMuted] = useState(false);
  const idleRef = useRef<number | null>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<SaveState | null>(null);
  const weatherTrackRef = useRef<string | null>(null);
  const nightTrackRef = useRef<boolean | null>(null);
  const resultsSfxRef = useRef(false);

  function commitSave(next: SaveState, tick = Date.now()) {
    const afterAilments = tickAilmentExpiry(next, tick);
    const weather = weatherAt(
      afterAilments.seed,
      afterAilments.runStartedAt,
      tick,
    );
    const refreshed = {
      ...afterAilments,
      comfort: computeComfort(afterAilments, weather),
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
    // Keep sceneProps — WorldScene must not unmount on death/tick.
  }

  useEffect(() => {
    const t = Date.now();
    setBestDays(loadMeta().bestDays);
    const loaded = loadOrCreate(t);
    const { state, death } = catchUp(loaded, t);
    if (death) {
      handleDeath(death);
      setSave(null);
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
    if (weatherTrackRef.current !== sceneProps.weather) {
      weatherTrackRef.current = sceneProps.weather;
      setWeatherTrack(sceneProps.weather);
    }
    const nightOn = sceneProps.dayPart === "night";
    if (nightTrackRef.current !== nightOn) {
      nightTrackRef.current = nightOn;
      setNightAmbience(nightOn);
    }
  }, [sceneProps]);

  useEffect(() => {
    setFireplaceBurning(!!save?.fireplace.lit);
  }, [save?.fireplace.lit]);

  useEffect(() => {
    setFireplaceProximity(fireplaceOpen ? "fireplace" : "beach");
  }, [fireplaceOpen]);

  useEffect(() => {
    const open = !!save?.pendingResults;
    if (open && !resultsSfxRef.current) {
      playSfx("activity_complete");
    }
    resultsSfxRef.current = open;
  }, [save?.pendingResults]);

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
    setShelterOpen(false);
    setContainerOpen(false);
    setOpenSpot(null);
    setRevealed(false);
  }

  const live = !!save && !!view && !ending;
  const sub = live
    ? `${DAY_PART_LABEL[view.dayPart]} · ${WEATHER_LABEL[view.weather]}`
    : "";
  const busy = !!(save && save.activity);
  const spotActivity = openSpot
    ? (HOTSPOT_ACTIVITY[openSpot] ?? null)
    : null;

  function onPhonePointer() {
    if (
      !live ||
      itemsOpen ||
      craftOpen ||
      diaryOpen ||
      youOpen ||
      fireplaceOpen ||
      shelterOpen ||
      save?.pendingResults ||
      save?.pendingOverflow ||
      containerOpen
    ) {
      return;
    }
    reveal();
  }

  function onSpotClick(id: HotspotId, e: React.MouseEvent) {
    e.stopPropagation();
    if (!live || !save) return;
    reveal();
    setPickerKind(null);

    if (id === "fire" && save.fireplace.built !== "none") {
      setFireplaceOpen(true);
      setShelterOpen(false);
      setOpenSpot(null);
      setRevealed(false);
      if (idleRef.current) window.clearTimeout(idleRef.current);
      return;
    }

    if (id === "hut" && save.shelterTier !== "none") {
      setShelterOpen(true);
      setFireplaceOpen(false);
      setOpenSpot(null);
      setRevealed(false);
      if (idleRef.current) window.clearTimeout(idleRef.current);
      return;
    }

    if (id === "storage") {
      if (openSpot === "storage") {
        openItemsFromSpot();
        return;
      }
      setOpenSpot("storage");
      return;
    }

    if (id === "water" && save.waterSpot.itemId) {
      const fill = currentWaterFill(save, now);
      if (openSpot === "water" && fill > 0) {
        commitSave(drinkFromWater(save, Date.now()));
        return;
      }
      setOpenSpot((cur) => (cur === id ? null : id));
      return;
    }

    setOpenSpot((cur) => (cur === id ? null : id));
  }

  function onActionClick(e: React.MouseEvent) {
    e.stopPropagation();
    reveal();
    if (!openSpot || !save) return;

    if (openSpot === "storage") {
      openItemsFromSpot();
      return;
    }

    if (openSpot === "fire" && save.fireplace.built === "none") {
      setCraftOpen(true);
      setOpenSpot(null);
      setRevealed(false);
      if (idleRef.current) window.clearTimeout(idleRef.current);
      return;
    }

    if (openSpot === "hut" && save.shelterTier === "none") {
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
    const kind = pickerKind;
    const weather = weatherAt(save.seed, save.runStartedAt, Date.now());
    if (weather === "omen") {
      setOmenConfirm({ kind, durationId });
      setPickerKind(null);
      return;
    }
    const next = startActivity(save, kind, durationId, Date.now());
    commitSave(next);
    setPickerKind(null);
    setOpenSpot(null);
    reveal();
  }

  function confirmOmenGo() {
    if (!save || !omenConfirm) return;
    const next = startActivity(
      save,
      omenConfirm.kind,
      omenConfirm.durationId,
      Date.now(),
    );
    commitSave(next);
    setOmenConfirm(null);
    setOpenSpot(null);
    reveal();
  }

  function confirmOmenStay() {
    setOmenConfirm(null);
    setOpenSpot(null);
    setRevealed(false);
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
    const at = Date.now();

    if (!lootFits(save.inventory, save.storageTier, beach.contents)) {
      let next: SaveState = {
        ...save,
        collectedTickIndex: beach.tickIndex,
        pendingOverflow: makeOverflow(
          containerTitle(beach.tier),
          "Washed up",
          beach.contents,
        ),
        pendingResults: null,
      };
      next = writeContainerDiary(next, {
        tier: beach.tier,
        kept: beach.contents,
        at,
      });
      commitSave(next);
      setContainerOpen(false);
      return;
    }

    const { inventory, kept, lost } = placeLoot(
      save.inventory,
      save.storageTier,
      beach.contents,
    );
    let next: SaveState = {
      ...save,
      inventory,
      collectedTickIndex: beach.tickIndex,
      pendingResults: {
        title: containerTitle(beach.tier),
        kept,
        lost,
        resolvedAt: at,
      },
      pendingOverflow: null,
    };
    next = writeContainerDiary(next, {
      tier: beach.tier,
      kept,
      at,
    });
    commitSave(next);
    setContainerOpen(false);
  }

  function resolveOverflow(decision: {
    keepIncoming: boolean[];
    destroyIndices: number[];
  }) {
    if (!save) return;
    const next = confirmOverflow(save, {
      ...decision,
      at: Date.now(),
    });
    commitSave(next);
  }

  function openItemsFromSpot() {
    playSfx("items");
    setItemsOpen(true);
    setCraftOpen(false);
    setDiaryOpen(false);
    setYouOpen(false);
    setFireplaceOpen(false);
    setShelterOpen(false);
    setOpenSpot(null);
    setPickerKind(null);
    setContainerOpen(false);
    setRevealed(false);
    if (idleRef.current) window.clearTimeout(idleRef.current);
  }

  function openItems(e: React.MouseEvent) {
    e.stopPropagation();
    openItemsFromSpot();
  }

  function openCraft(e: React.MouseEvent) {
    e.stopPropagation();
    playSfx("build");
    setCraftOpen(true);
    setItemsOpen(false);
    setDiaryOpen(false);
    setYouOpen(false);
    setFireplaceOpen(false);
    setShelterOpen(false);
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
    setShelterOpen(false);
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
    setShelterOpen(false);
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

  function onCureAilment(
    ailmentId: "cut_finger" | "twisted_ankle" | "cold",
  ) {
    if (!save) return;
    const next = cureAilmentWithItem(save, ailmentId, Date.now());
    if (!next) return;
    commitSave(next);
  }

  function onWear(inventoryIndex: number): string | null {
    if (!save) return "Nothing to wear.";
    const result = wearClothing(save, inventoryIndex);
    if (!result.ok) return result.reason;
    commitSave(result.state);
    return null;
  }

  function onUnequip(slot: ClothingSlotId): string | null {
    if (!save) return "Nothing worn.";
    const result = unequipClothing(save, slot);
    if (!result.ok) return result.reason;
    commitSave(result.state);
    return null;
  }

  function onWaterDrop(inventoryIndex: number) {
    setOutside(inventoryIndex);
  }

  let captionTitle = openHotspot?.title ?? "";
  let captionBody = openHotspot?.description ?? "";
  let captionAction: string | null = openHotspot?.action ?? null;
  let showAction = true;

  if (live && save && openHotspot?.id === "fire") {
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
  } else if (live && save && openHotspot?.id === "hut") {
    if (save.shelterTier !== "none") {
      captionTitle =
        save.shelterTier === "lean_to"
          ? "Lean-to"
          : save.shelterTier === "walled"
            ? "Walled Shelter"
            : "Storm-proof Shelter";
      captionBody = "Tap again to step inside.";
      showAction = false;
      captionAction = null;
    } else {
      captionBody =
        "A patch of shade waiting. Craft a Lean-to to claim it.";
      captionAction = "Build";
    }
  } else if (live && save && openHotspot?.id === "water") {
    if (save.waterSpot.itemId && isWaterVesselId(save.waterSpot.itemId)) {
      const fill = currentWaterFill(save, now);
      captionTitle = waterSpotCaption(save.waterSpot.itemId, fill);
      captionBody =
        fill > 0
          ? "Tap again to drink. Remainder stays in the vessel."
          : "Empty. Rain fills it slowly; a storm fills it fast.";
      captionAction = fill > 0 ? "Drink" : null;
      showAction = !!captionAction;
    } else if (save.waterSpot.itemId) {
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
  } else if (live && save && openHotspot?.id === "storage") {
    const slots = storageSlotCount(save.storageTier);
    const used = save.inventory.length;
    const name = STORAGE_TIER_NAME[save.storageTier];
    captionTitle = `${name} — ${used} of ${slots} slots`;
    captionBody = "Tap again to open your items.";
    captionAction = "Open";
    showAction = true;
  } else if (live && save && openHotspot && busy && save.activity) {
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
  } else if (live && save && openHotspot && spotActivity) {
    const gate = canStartActivity(save, spotActivity);
    if (!gate.ok && !busy) {
      captionBody = gate.reason;
      showAction = false;
    }
  } else if (openHotspot && !spotActivity) {
    showAction = !!openHotspot.action;
  }

  const pickerBlocked =
    live &&
    pickerKind &&
    save &&
    pickerKind !== "craft" &&
    pickerKind !== "cook"
      ? (() => {
          const g = canStartActivity(save, pickerKind);
          return g.ok ? null : g.reason;
        })()
      : null;

  // WorldScene is ALWAYS the first child of .phone — never behind an early
  // return that swaps the tree. Tick state updates HUD siblings only.
  const scene = sceneProps ?? DEFAULT_SCENE_PROPS;

  return (
    <PointerDragProvider>
    <div
      className="phone"
      ref={phoneRef}
      onClick={onPhonePointer}
      aria-busy={!live && !ending ? true : undefined}
    >
      <WorldScene {...scene} />

      <GrainOverlay />
      <div className="vignette" />

      {ending && (
        <EndingScreen
          days={ending.days}
          line={ending.line}
          bestDays={bestDays}
          onNewRun={startNewRun}
        />
      )}

      {live && save && view && (
        <>
          {view.beach && (
            <BeachCrate container={view.beach} onOpen={openContainer} />
          )}

          <DropTarget
            id="water-spot"
            className={`water-drop${itemsOpen ? " active" : ""}`}
            overClassName="drop-over"
            accept={(p) => p.kind === "water"}
            onDrop={(p) => onWaterDrop(p.inventoryIndex)}
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

            {(hasItem(save.inventory, "wristwatch") ||
              hasItem(save.inventory, "compass")) && (
              <div className="hud-trinkets">
                {hasItem(save.inventory, "wristwatch") && (
                  <WristwatchHud now={now} />
                )}
                {hasItem(save.inventory, "compass") && <CompassHud />}
              </div>
            )}

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
                !!pickerKind &&
                pickerKind !== "craft" &&
                pickerKind !== "cook"
              }
              kind={
                pickerKind === "craft" || pickerKind === "cook"
                  ? null
                  : pickerKind
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
            entries={save?.diary ?? []}
            onClose={() => setDiaryOpen(false)}
            onOpened={() => playSfx("diary")}
          />

          <YouSheet
            open={youOpen}
            save={save}
            weather={view.weather}
            onClose={() => setYouOpen(false)}
            onCureAilment={onCureAilment}
            onUnequip={onUnequip}
          />

          <ItemsSheet
            open={itemsOpen}
            inventory={save.inventory}
            storageTier={save.storageTier}
            onClose={() => setItemsOpen(false)}
            onSetOutside={setOutside}
            onEat={onEat}
            onDestroy={onDestroy}
            onWear={onWear}
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

          <ShelterScreen
            open={shelterOpen}
            save={save}
            onClose={() => setShelterOpen(false)}
            onChange={(next) => {
              commitSave(next);
            }}
          />

          <ResultsPanel
            results={save.pendingResults}
            onDismiss={dismissResults}
          />

          {save.pendingOverflow && (
            <OverflowScreen
              open
              save={save}
              overflow={save.pendingOverflow}
              onConfirm={resolveOverflow}
            />
          )}

          <OmenWarning
            open={!!omenConfirm}
            onGo={confirmOmenGo}
            onStay={confirmOmenStay}
          />

          <ContainerPanel
            container={view.beach}
            open={containerOpen}
            onClose={() => setContainerOpen(false)}
            onTake={takeContainer}
          />
        </>
      )}
    </div>
    </PointerDragProvider>
  );
}
