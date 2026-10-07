export interface Cartridge {
  name: string;
  label: string;
  art: "custom";
  sys: string;
  genre: string;
  custom?: boolean;
  slug?: string;
  localId?: string;
  rom?: string;
  missing?: boolean;
  rotation?: number;
}
export interface LibraryRecord {
  id: string;
  game: Cartridge;
  blob: Blob;
}
export interface Snapshot {
  state: Uint8Array;
  savedAt: number;
}
export interface CommandData {
  init: {
    url: string;
    key: string;
    core: "mgba" | "gambatte";
    rotation: number;
    muted: boolean;
    speed: number;
  };
  input: { index: number; value: number };
  speed: { speed: number };
  mute: { muted: boolean };
  pause: Record<string, never>;
  resume: Record<string, never>;
  reset: Record<string, never>;
  flush: { request: number };
}
export type PlayerCommand = {
  [K in keyof CommandData]: { type: K } & CommandData[K];
}[keyof CommandData];
export type PlayerEvent =
  | { type: "started" }
  | { type: "notice" | "error"; message: string }
  | { type: "flushed"; request: number };
