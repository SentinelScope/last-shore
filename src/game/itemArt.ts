import type { ItemDef } from "./items";
import manifest from "../../public/items/_manifest.json";

type ItemManifest = {
  files?: string[];
  /** Bare item ids (no .png) — preferred in the checked-in manifest. */
  canonical?: string[];
  aliases: Record<string, string>;
};

const data = manifest as ItemManifest;

const FILE_SET = new Set(
  (data.files ?? data.canonical ?? []).map((name) =>
    name.endsWith(".png") ? name : `${name}.png`,
  ),
);
const ALIASES = data.aliases;

/** Resolve an item/recipe id to a PNG filename that exists in the manifest. */
export function resolveItemFile(id: string): string {
  let cur = id;
  const seen = new Set<string>();
  while (ALIASES[cur] && !seen.has(cur)) {
    seen.add(cur);
    cur = ALIASES[cur]!;
  }
  const file = cur.endsWith(".png") ? cur : `${cur}.png`;
  return file;
}

export function itemArtSrc(id: string): string {
  return `/items/${resolveItemFile(id)}`;
}

/** Dev-only: every ITEMS id must resolve to a listed PNG. */
export function assertItemArt(items: Record<string, ItemDef>): void {
  if (process.env.NODE_ENV === "production") return;
  const bad: string[] = [];
  for (const id of Object.keys(items)) {
    const file = resolveItemFile(id);
    if (!FILE_SET.has(file)) bad.push(`${id} → ${file}`);
  }
  if (bad.length > 0) {
    throw new Error(
      `Item art missing from public/items/_manifest.json:\n  ${bad.join("\n  ")}`,
    );
  }
}
