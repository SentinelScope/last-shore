/**
 * Salvaged government file pages — the only foreshadowing for the secret ending.
 * Texts are verbatim from the design source; line breaks are intentional.
 */

import { LOOT_POOLS } from "./balance";

export const DOCUMENT_COUNT = 9;

export type DocumentNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type DocumentItemId =
  | "document_1"
  | "document_2"
  | "document_3"
  | "document_4"
  | "document_5"
  | "document_6"
  | "document_7"
  | "document_8"
  | "document_9";

/** Body text keyed by document number. Preserve whitespace when rendering. */
export const DOCUMENT_BODIES: Record<DocumentNumber, string> = {
  1: `To: Internal Review Committee Classification: TOP SECRET – EYES ONLY

The object crashed at 03:17 local time.

Contrary to early media reports, it was not a weather balloon, a
satellite, or a spy plane.

Recovery teams secured metallic debris exhibiting properties
inconsistent with known aerospace materials. One technician described it
as “metal that couldn’t decide what shape it wanted to be.”

Recovery is still underway. Media blackout is... (the rest of the document looks like it was burned)`,

  2: `Simple Chili con Carne Recipe (Serves 4)

Ingredients

500 g (1 lb) ground beef
1 onion, diced
2 cloves garlic, minced
1 red bell pepper, diced
2 tbsp tomato paste
1 can (400 g / 14 oz) chopped tomatoes
1 can (400 g / 14 oz) kidney beans, drained
1 tsp ground cumin
1 tsp paprika
½ tsp chili powder (more if you like it spicy)
Salt and black pepper to taste
2 tbsp vegetable oil
Optional: fresh parsley or cilantro for garnish

Instructions

Heat the oil in a large pot over medium heat.
Cook the onion and bell pepper for about 5 minutes until softened.
Add the garlic and cook for 30 seconds.
Add the ground beef and cook until browned, breaking it apart with a spoon.
Stir in the tomato paste, cumin, paprika, chili powder, salt, and pepper. Cook for 1 minute.
Add the chopped tomatoes and stir well.
Simmer for 15 minutes over low heat.
Stir in the kidney beans and cook for another 10 minutes.
Taste and adjust the seasoning if needed.

Serving Suggestions
Serve hot with:

Steamed rice
Crusty bread
Tortilla chips
Sour cream and grated cheddar cheese (optional)`,

  3: `International Oceanic Hazard Assessment Agency
Research Memorandum 14-73B

Preliminary Correlation Between Crimson Skies and Megatsunamis

Analysis of twelve historical megatsunami events revealed that eleven were preceded by unusually deep crimson skies between before impact.

Researchers emphasize that the phenomenon does not prove causation, but its consistency cannot currently be explained by known atmospheric or geological processes.

Several monitoring stations have begun recording major red-sky events alongside seismic activity as a precaution.

Status: Correlation observed. Cause unknown. Further investigation recommended.`,

  4: `Scientific Memorandum

Analysis of recovered material suggests the craft was not built.

It appears… grown.

Material reacts to music.

Jazz causes faint blue illumination.

Heavy metal causes mild structural panic.

Country music caused one sample to eject itself through a laboratory
window.

Research ongoing.`,

  5: `Interview Transcript

Witness: Park Ranger Thomas Hale

Q: Did you observe the creature?

A: Yes.

Q: Describe it.

A: Small. Large head and eyes. No hair at all.

Q: Like a grey alien?

A: That’s what I thought.

Q: Then?

A: It came out of the UFO, knocked twice, and I opened
the door.

…

Interview suspended for coffee.`,

  6: `National Atmospheric Research Center
Statistical Bulletin 07-21

Probability of Lightning Strike During Thunderstorms

A review of national lightning incidents found that the average probability of an individual being struck by lightning during a thunderstorm remains extremely low, estimated at less than 0.001% per event under normal circumstances.

Researchers note that risk increases significantly for individuals in open fields, on elevated terrain, or near isolated trees and bodies of water.

The findings reinforce current safety guidance: seek enclosed shelter immediately when thunder is heard.

Lightning strikes remain statistically rare but are highly preventable through proper precautions.`,

  7: `Laboratory Incident Report #88

09:43 – Artifact begins emitting rhythmic beeping.

09:45 – Something large spawned above the laboratory.

09:49 – They took one of our scientists.

09:50 – They left.

J. Willis has been missing for eight months.`,

  8: `Personal Journal – Dr. Foresthal

I’ve spent twenty years studying this subject.

Yesterday I watched quantum mechanics being broken by [REDACTED]. I appeared confused. They looked disappointed.`,

  9: `FINAL MEMORANDUM

If this document is being read, Project Majestic has officially been
terminated.

Official reason: “No evidence of extraterrestrial activity.”

Actual inventory at closure:

We are beginning to believe that this species hasn't come from a different planet, 
but has evolved here on earth, living hidden in our deep oceans and 
extensive cave systems for millions of years. 
I’m beginning to question which species is actually more advanced.

Seal the archives.

Never speak of this again.`,
};

const DOC_ID_RE = /^document_([1-9])$/;

export function isDocumentItemId(itemId: string): itemId is DocumentItemId {
  return DOC_ID_RE.test(itemId);
}

export function documentNumber(itemId: string): DocumentNumber | null {
  const m = itemId.match(DOC_ID_RE);
  if (!m) return null;
  return Number(m[1]) as DocumentNumber;
}

export function documentItemId(n: DocumentNumber): DocumentItemId {
  return `document_${n}`;
}

export function documentTitle(n: DocumentNumber): string {
  return `Document #${n}`;
}

export function pickDocumentItemId(rng: () => number): DocumentItemId {
  const n = (1 + Math.floor(rng() * DOCUMENT_COUNT)) as DocumentNumber;
  return documentItemId(n);
}

/** Paper usable as fireplace tinder. */
export function isBurnablePaper(itemId: string): boolean {
  return (
    itemId === "tinder" ||
    itemId === "magazine" ||
    itemId === "book" ||
    isDocumentItemId(itemId)
  );
}

export function sortRecovered(nums: readonly number[]): DocumentNumber[] {
  const set = new Set<DocumentNumber>();
  for (const n of nums) {
    if (n >= 1 && n <= DOCUMENT_COUNT) set.add(n as DocumentNumber);
  }
  return [...set].sort((a, b) => a - b);
}

export function withRecoveredDocument(
  recovered: readonly number[],
  itemId: string,
): DocumentNumber[] {
  const n = documentNumber(itemId);
  if (n == null) return sortRecovered(recovered);
  return sortRecovered([...recovered, n]);
}

export function withoutRecoveredDocument(
  recovered: readonly number[],
  itemId: string,
): DocumentNumber[] {
  const n = documentNumber(itemId);
  if (n == null) return sortRecovered(recovered);
  return sortRecovered(recovered.filter((x) => x !== n));
}

/** Add every document in `itemIds` to the recovered set. */
export function noteDocumentsFound(
  recovered: readonly number[],
  itemIds: readonly string[],
): DocumentNumber[] {
  let next = sortRecovered(recovered);
  for (const id of itemIds) {
    next = withRecoveredDocument(next, id);
  }
  return next;
}

/** Mark a document as read. Permanent — burning does not clear this. */
export function noteDocumentRead(
  documentsRead: readonly number[],
  n: DocumentNumber,
): DocumentNumber[] {
  return sortRecovered([...documentsRead, n]);
}

export function allDocumentsRead(documentsRead: readonly number[]): boolean {
  return sortRecovered(documentsRead).length >= DOCUMENT_COUNT;
}

/** Gated secret photograph — only after all nine documents have been read. */
export const SECRET_PHOTO_ID = "lab04_s4_a51";

const LOOT_POOLS_VERY_RARE: readonly string[] = LOOT_POOLS.very_rare;

/** Very-rare pool for a container tier. Explicit large/chest gate for the photo. */
export function veryRarePoolFor(
  tier: "small" | "medium" | "large" | "chest",
  documentsRead: readonly number[],
): readonly string[] {
  const base = [...LOOT_POOLS_VERY_RARE];
  // Explicit tier filter — never Small or Medium, even if those later roll VR.
  if (
    allDocumentsRead(documentsRead) &&
    (tier === "large" || tier === "chest")
  ) {
    return [...base, SECRET_PHOTO_ID];
  }
  return base;
}
