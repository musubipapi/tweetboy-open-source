import type { PlayerCommand, PlayerEvent, Snapshot } from "./types.js";
let initialized = false;
let gameKey = "";
let ready = false;
let gameSpeed = 1;
let fastHeld = false;
function applySpeed() {
  const speed = fastHeld ? Math.max(3, gameSpeed) : gameSpeed;
  const manager = window.EJS_emulator.gameManager;
  manager.setFastForwardRatio(speed);
  manager.toggleFastForward(speed > 1);
  document.body.dataset.gameSpeed = String(speed);
}
const pressedAt = new Map();
const releaseTimers = new Map();
const send = (message: PlayerEvent) => parent.postMessage(message, location.origin);
const dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open("pocket-saves", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("states");
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const autosaveKey = () => "autosave:" + gameKey;
async function readState(key: string): Promise<Snapshot | Uint8Array> {
  const database = await dbPromise;
  return new Promise((resolve, reject) => {
    const request = database.transaction("states").objectStore("states").get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function writeState(state: Snapshot) {
  const database = await dbPromise;
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction("states", "readwrite");
    transaction.objectStore("states").put(state, autosaveKey());
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
let saving = Promise.resolve();
let isPaused = false;
let storageWarning = false;
function autosave() {
  if (!ready) return saving;
  // Serialize snapshots so an older write cannot replace newer progress.
  saving = saving
    .then(async () => {
      const record = { state: EJS_emulator.gameManager.getState(), savedAt: Date.now() };
      document.body.dataset.autosaveStatus = "saving";
      await writeState(record);
      document.body.dataset.autosaveAt = String(record.savedAt);
      document.body.dataset.autosaveStatus = "saved";
    })
    .catch(() => {
      document.body.dataset.autosaveStatus = "unavailable";
      if (!storageWarning) {
        storageWarning = true;
        send({
          type: "notice",
          message: "Automatic saves are unavailable. Check browser storage.",
        });
      }
    });
  return saving;
}
async function restoreAutosave() {
  try {
    const record = (await readState(autosaveKey())) as Snapshot;
    // Preserve the last manually saved position when migrating older players.
    const state = record?.state || ((await readState(gameKey)) as Uint8Array);
    if (state) {
      EJS_emulator.gameManager.loadState(state);
      for (const index of [0, 2, 3, 4, 5, 6, 7, 8, 10, 11, 27])
        EJS_emulator.gameManager.simulateInput(0, index, 0);
      document.body.dataset.restoredAt = String(record?.savedAt || "legacy");
      send({ type: "notice", message: "Resumed where you left off" });
    }
  } catch {
    send({
      type: "notice",
      message: "Could not resume the previous session. In-game saves are still available.",
    });
  }
}
async function clearSnapshot() {
  await saving;
  const database = await dbPromise;
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction("states", "readwrite");
    const store = transaction.objectStore("states");
    store.delete(autosaveKey());
    store.delete(gameKey);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
function saveBatteryFiles() {
  if (ready) EJS_emulator.gameManager.saveSaveFiles();
}
window.addEventListener("message", async (event) => {
  if (event.source !== parent || event.origin !== location.origin) return;
  const message = event.data as PlayerCommand;
  if (message.type === "init" && !initialized) {
    initialized = true;
    gameKey = message.key;
    gameSpeed = [1, 1.5, 2, 3, 4].includes(message.speed) ? message.speed : 1;
    window.EJS_videoRotation = message.rotation || 0;
    window.EJS_player = "#game";
    window.EJS_gameUrl = message.url;
    window.EJS_gameName = message.key;
    window.EJS_core = message.core;
    window.EJS_pathtodata = "https://cdn.emulatorjs.org/4.2.3/data/";
    window.EJS_startOnLoaded = true;
    window.EJS_threads = false;
    window.EJS_disableAutoLang = true;
    window.EJS_noAutoFocus = true;
    window.EJS_backgroundColor = "#101512";
    window.EJS_volume = message.muted ? 0 : 0.5;
    window.EJS_defaultOptions = {
      "save-save-interval": "5",
      "save-state-location": "browser",
      keyboardInput: "disabled",
      altKeyboardInput: "disabled",
      shader: "disabled",
      vsync: "enabled",
    };
    window.EJS_Buttons = {
      playPause: false,
      restart: false,
      mute: false,
      settings: false,
      fullscreen: false,
      saveState: false,
      loadState: false,
      screenRecord: false,
      gamepad: false,
      cheat: false,
      volume: false,
      saveSavFiles: false,
      loadSavFiles: false,
      quickSave: false,
      quickLoad: false,
      screenshot: false,
      cacheManager: false,
      exitEmulation: false,
      contextMenu: false,
    };
    function audioContext() {
      const ctx = window.EJS_emulator?.Module?.AL?.currentCtx;
      return (
        ctx?.audioCtx || (ctx?.sources?.find((source) => source.gain)?.gain.context as AudioContext)
      );
    }
    window.PocketAudioResume = () => {
      const ctx = audioContext();
      if (ctx?.state === "suspended") ctx.resume();
    };
    // The core must advance while browser audio is suspended. A fixed handheld
    // clock also avoids running twice as fast on 120 Hz displays.
    const frameMs = 1000 / 59.7275;
    let nextTick = performance.now();
    let timer = 0;
    let rafID = 0;
    const callbacks = new Map();
    function tick() {
      timer = 0;
      const now = performance.now();
      const batch = Array.from(callbacks.values());
      callbacks.clear();
      nextTick = Math.max(nextTick + frameMs, now);
      for (const callback of batch) callback(now);
    }
    window.requestAnimationFrame = (callback) => {
      const id = ++rafID;
      callbacks.set(id, callback);
      if (!timer) timer = setTimeout(tick, Math.max(0, nextTick - performance.now()));
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      callbacks.delete(id);
    };
    // Keep the larger audio queue that absorbs scheduling stalls.
    window.EJS_ready = () => {
      const original = window.EJS_GameManager.prototype.getRetroArchCfg;
      window.EJS_GameManager.prototype.getRetroArchCfg = function () {
        return (
          original
            .call(this)
            .replace(
              /^video_top_portrait_viewport\s*=.*queryElement/gm,
              "video_top_portrait_viewport = false",
            )
            .replace(/^audio_latency\s*=.*queryElement/gm, "audio_latency = 128")
            .replace(/^video_vsync\s*=.*queryElement/gm, "video_vsync = true") +
          "\naudio_sync = false\n"
        );
      };
    };
    window.EJS_onGameStart = async () => {
      EJS_emulator.gameManager.setVSync(true);
      EJS_emulator.gameManager.setKeyboardEnabled(false);
      document.body.dataset.audioConfig = EJS_emulator.gameManager.FS.readFile(
        "/home/web_user/.config/retroarch/retroarch.cfg",
        { encoding: "utf8" },
      )
        .split("\n")
        .filter((line) => /^(audio_latency|audio_sync|audio_out_rate|video_vsync)\s*=/.test(line))
        .join("\n");
      let frames = EJS_emulator.gameManager.getFrameNum();
      let time = performance.now();
      setInterval(() => {
        const now = performance.now();
        const count = EJS_emulator.gameManager.getFrameNum();
        document.body.dataset.emulationFps = (((count - frames) * 1000) / (now - time)).toFixed(1);
        document.body.dataset.audioSampleRate = String(audioContext()?.sampleRate || "");
        document.body.dataset.audioState = audioContext()?.state || "";
        frames = count;
        time = now;
      }, 5000);
      await restoreAutosave();
      ready = true;
      applySpeed();
      setInterval(() => {
        if (!isPaused) autosave();
      }, 30000);
      send({ type: "started" });
    };
    const script = document.createElement("script");
    script.src = window.EJS_pathtodata + "loader.js";
    script.onerror = () =>
      send({
        type: "error",
        message: "Could not start the emulator. Try loading the cartridge again.",
      });
    document.body.append(script);
    return;
  }
  if (!ready) return;
  try {
    const emulator = window.EJS_emulator;
    switch (message.type) {
      case "speed":
        if ([1, 1.5, 2, 3, 4].includes(message.speed)) {
          gameSpeed = message.speed;
          applySpeed();
        }
        break;
      case "input": {
        if (message.index === 27) {
          fastHeld = !!message.value;
          applySpeed();
          break;
        }
        clearTimeout(releaseTimers.get(message.index));
        if (message.value) {
          pressedAt.set(message.index, performance.now());
          emulator.gameManager.simulateInput(0, message.index, 1);
          window.PocketAudioResume();
        } else {
          const delay = Math.max(0, 60 - (performance.now() - (pressedAt.get(message.index) || 0)));
          releaseTimers.set(
            message.index,
            setTimeout(() => emulator.gameManager.simulateInput(0, message.index, 0), delay),
          );
        }
        break;
      }
      case "pause":
        isPaused = true;
        emulator.pause();
        saveBatteryFiles();
        await autosave();
        break;
      case "resume":
        isPaused = false;
        emulator.play();
        break;
      case "mute":
        emulator.setVolume(message.muted ? 0 : 0.5);
        break;
      case "reset":
        await clearSnapshot();
        emulator.gameManager.restart();
        applySpeed();
        break;
      case "flush":
        saveBatteryFiles();
        await autosave();
        send({ type: "flushed", request: message.request });
        break;
    }
  } catch (error) {
    send({
      type: "error",
      message: "Could not " + message.type + ". Browser storage may be unavailable or full.",
    });
  }
});
window.addEventListener("pagehide", () => {
  saveBatteryFiles();
  autosave();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    saveBatteryFiles();
    autosave();
  }
});
window.addEventListener("error", (event) =>
  send({ type: "error", message: "Emulator error: " + event.message }),
);
