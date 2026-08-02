export type HotspotId =
  | "shore"
  | "palm"
  | "water"
  | "fire"
  | "hut"
  | "storage"
  | "tool_rack";

export type HotspotDef = {
  id: HotspotId;
  className: string;
  title: string;
  description: string;
  action: string;
};

export const HOTSPOTS: HotspotDef[] = [
  {
    id: "shore",
    className: "s-shore",
    title: "Tideline",
    description: "Where the sea leaves what it no longer wants.",
    action: "Scour",
  },
  {
    id: "palm",
    className: "s-palm",
    title: "Palm grove",
    description: "Four trunks standing. Wood lives in them.",
    action: "Cut",
  },
  {
    id: "fire",
    className: "s-fire",
    title: "Fireplace",
    description: "A ring of stones on the sand. Cold for now.",
    action: "Build",
  },
  {
    id: "hut",
    className: "s-hut",
    title: "Shelter",
    description: "A patch of shade and a place to sleep.",
    action: "Build",
  },
  {
    id: "water",
    className: "s-water",
    title: "Water collection",
    description: "Set a cup out and wait for rain. It never evaporates.",
    action: "Look",
  },
  {
    id: "storage",
    className: "s-storage",
    title: "Storage",
    description: "Where your supplies live.",
    action: "Open",
  },
  {
    id: "tool_rack",
    className: "s-tool-rack",
    title: "Tool Rack",
    description: "Three pegs by the stores. Tools live here.",
    action: "Open",
  },
];
