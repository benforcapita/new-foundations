export const LOD_ZOOM_THRESHOLD = 0.9;

export type LodMode = "detailed" | "collapsed";

export function lodMode(zoom: number): LodMode {
  return zoom < LOD_ZOOM_THRESHOLD ? "collapsed" : "detailed";
}

/** True when the District Building List should be offered because overlays collapsed. */
export function districtListSignal(zoom: number): boolean {
  return lodMode(zoom) === "collapsed";
}
