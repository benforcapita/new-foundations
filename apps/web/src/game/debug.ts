export type NfDebug = {
  readonly ready: boolean;
  cellClient: (x: number, y: number) => { x: number; y: number };
  focusCell: (x: number, y: number) => void;
  latencyMs: () => number;
  cropOffset: () => number;
};

declare global {
  interface Window {
    __nfDebug?: NfDebug;
  }
}
