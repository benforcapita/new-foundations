import balance from "./decorations.balance.json" with { type: "json" };

export type DecorationTune = {
  readonly boost: number;
  readonly radius: number;
};

function readTune(entry: { boost: number; radius: number }, label: string): DecorationTune {
  if (!Number.isFinite(entry.boost) || entry.boost < 0) {
    throw new Error(`${label} boost must be a non-negative number`);
  }
  if (!Number.isInteger(entry.radius) || entry.radius < 0) {
    throw new Error(`${label} radius must be a non-negative integer`);
  }
  return { boost: entry.boost, radius: entry.radius };
}

export const STREET_DECORATION = readTune(balance.street, "street decoration");
export const LANDMARK_DECORATION = readTune(balance.landmark, "landmark decoration");
