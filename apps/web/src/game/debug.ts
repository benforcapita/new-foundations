export type NfDebug = {
  readonly ready: boolean;
  cellClient: (x: number, y: number) => { x: number; y: number };
  worldClient: (x: number, y: number) => { x: number; y: number };
  focusCell: (x: number, y: number) => void;
  focusWorld: (x: number, y: number, zoom: number) => void;
  latencyMs: () => number;
  cropOffset: () => number;
};

declare global {
  interface Window {
    __nfDebug?: NfDebug;
  }
}
