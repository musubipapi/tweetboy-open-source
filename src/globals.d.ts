interface EmulatorGameManager {
  setFastForwardRatio(speed: number): void;
  toggleFastForward(enabled: boolean): void;
  simulateInput(player: number, index: number, value: number): void;
  getState(): Uint8Array;
  loadState(state: Uint8Array): void;
  saveSaveFiles(): void;
  restart(): void;
  setVSync(enabled: boolean): void;
  setKeyboardEnabled(enabled: boolean): void;
  getFrameNum(): number;
  getRetroArchCfg(): string;
  FS: { readFile(path: string, options: { encoding: string }): string };
}
interface Emulator {
  gameManager: EmulatorGameManager;
  Module: { AL?: { currentCtx?: { audioCtx?: AudioContext; sources?: { gain?: GainNode }[] } } };
  pause(): void;
  play(): void;
  setVolume(volume: number): void;
}
declare var EJS_emulator: Emulator;
interface Window {
  EJS_emulator: Emulator;
  EJS_GameManager: { prototype: EmulatorGameManager };
  EJS_videoRotation: number;
  EJS_player: string;
  EJS_gameUrl: string;
  EJS_gameName: string;
  EJS_core: string;
  EJS_pathtodata: string;
  EJS_startOnLoaded: boolean;
  EJS_threads: boolean;
  EJS_disableAutoLang: boolean;
  EJS_noAutoFocus: boolean;
  EJS_backgroundColor: string;
  EJS_volume: number;
  EJS_defaultOptions: Record<string, string>;
  EJS_Buttons: Record<string, boolean>;
  EJS_ready: () => void;
  EJS_onGameStart: () => Promise<void>;
  PocketAudioResume?: () => void;
}
interface Document {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void>;
}
interface HTMLElement { webkitRequestFullscreen?: () => Promise<void> }
