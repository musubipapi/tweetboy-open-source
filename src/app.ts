import type { Cartridge, LibraryRecord, CommandData, PlayerEvent } from "./types.js";
const queryElement = (s) => document.querySelector(s);
const consoleElement = queryElement("#console");
const display = queryElement("#display");
const boot = queryElement("#boot");
const veil = queryElement("#veil");
const menu = queryElement("#menu");
const toastElement = queryElement("#toast");
const dpad = queryElement("#dpad");
const soundKey = queryElement("#sound");
const embed = document.documentElement.classList.contains("embed");
const params = new URLSearchParams(location.search);
const coarse = matchMedia("(pointer:coarse)").matches;

const shellColors = {
  violet: "none",
  mint: "hue-rotate(240deg)",
  blue: "hue-rotate(325deg)",
  rose: "hue-rotate(55deg)",
  gold: "hue-rotate(145deg)",
  slate: "grayscale(1)",
};
function setShellColor(color) {
  if (!Object.hasOwn(shellColors, color)) color = "violet";
  document.documentElement.style.setProperty("--skin-filter", shellColors[color]);
  document
    .querySelectorAll<HTMLInputElement>('[name="shell-color"]')
    .forEach((input) => (input.checked = input.value === color));
  try {
    localStorage.setItem("tweetboy.shell-color", color);
  } catch {}
}
let savedColor = "violet";
try {
  savedColor = localStorage.getItem("tweetboy.shell-color") || "violet";
} catch {}
setShellColor(savedColor);
document
  .querySelectorAll<HTMLInputElement>('[name="shell-color"]')
  .forEach((input) => (input.onchange = () => setShellColor(input.value)));

const speeds = [1, 1.5, 2, 3, 4];
let gameSpeed = 1;
try {
  const saved = Number(localStorage.getItem("tweetboy.speed"));
  if (speeds.includes(saved)) gameSpeed = saved;
} catch {}
queryElement("#game-speed").value = String(gameSpeed);
queryElement("#game-speed").addEventListener("change", (event) => {
  gameSpeed = Number(event.target.value);
  try {
    localStorage.setItem("tweetboy.speed", String(gameSpeed));
  } catch {}
  send("speed", { speed: gameSpeed });
});
const ART = {
  custom:
    '<text x="24" y="21" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-weight="800" font-size="15" fill="#efe7d4">?</text>',
};
const systemFromFilename = (name) =>
  ({ gb: "GB", gbc: "GBC", gba: "GBA" })[name.split(".").pop().toLowerCase()];
const GAMES: Cartridge[] = [];

let localGames: Cartridge[] = [];
const getCartridges = () => [...GAMES, ...localGames];
let libraryDB: Promise<IDBDatabase>;
function openLibrary() {
  if (!libraryDB)
    libraryDB = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("tweetboy-library", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("games", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(Error("Close other Tweetboy tabs to open your library."));
    });
  return libraryDB;
}
async function libraryRead(id?: string): Promise<LibraryRecord | LibraryRecord[]> {
  const database = await openLibrary();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("games", "readonly");
    const request = id
      ? transaction.objectStore("games").get(id)
      : transaction.objectStore("games").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function storeROM(file: File, hash: string, game: Cartridge) {
  const saved = {
    ...game,
    slug: "local-" + hash,
    localId: hash,
    rom: file.name,
    genre: "On this device",
  };
  const database = await openLibrary();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction("games", "readwrite");
    transaction.objectStore("games").put({ id: hash, game: saved, blob: file });
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
  localGames = localGames.filter((game) => game.localId !== hash);
  localGames.push(saved);
  buildShelf();
  return saved;
}
async function restoreLibrary() {
  try {
    const records = (await libraryRead()) as LibraryRecord[];
    localGames = records.map((record) => record.game);
    buildShelf();
  } catch {
    toast("Local ROM storage is unavailable. You can still import and play.");
  }
}

const mapping = {
  B: 0,
  Select: 2,
  Start: 3,
  Up: 4,
  Down: 5,
  Left: 6,
  Right: 7,
  A: 8,
  L: 10,
  R: 11,
  Fast: 27,
};
const defaultKeys = {
  KeyW: "Up",
  KeyA: "Left",
  KeyS: "Down",
  KeyD: "Right",
  KeyJ: "B",
  KeyK: "A",
  KeyR: "L",
  KeyU: "R",
  Digit1: "Select",
  Digit2: "Start",
  ShiftLeft: "Fast",
  ShiftRight: "Fast",
};
let keys: Record<string, string> = { ...defaultKeys };
try {
  if (localStorage.getItem("tweetboy.key-layout") !== "2") {
    localStorage.setItem("tweetboy.keys", JSON.stringify(defaultKeys));
    localStorage.setItem("tweetboy.key-layout", "2");
  }
  const saved = JSON.parse(localStorage.getItem("tweetboy.keys"));
  if (saved && typeof saved === "object" && !Array.isArray(saved)) {
    const valid = Object.entries(saved as Record<string, string>).filter(
      ([code, name]) =>
        /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Enter|NumpadEnter|Backspace|Space|Shift(Left|Right)|Bracket(Left|Right)|Comma|Period|Slash|Semicolon|Quote|Minus|Equal)queryElement/.test(
          code,
        ) &&
        Object.hasOwn(mapping, name) &&
        !["KeyM", "KeyP"].includes(code),
    );
    if (valid.length) keys = Object.fromEntries(valid);
  }
} catch {}
let captureKey = null;
function keyLabel(code) {
  return code.startsWith("Key")
    ? code.slice(3)
    : code.startsWith("Digit")
      ? code.slice(5)
      : {
          ArrowUp: "↑",
          ArrowDown: "↓",
          ArrowLeft: "←",
          ArrowRight: "→",
          ShiftLeft: "Left Shift",
          ShiftRight: "Right Shift",
          Backspace: "⌫",
          Space: "Space",
        }[code] || code;
}
const mapFrames = {
  Up: [57, 61, 44, 44],
  Down: [57, 145, 44, 44],
  Left: [15, 103, 44, 44],
  Right: [99, 103, 44, 44],
  A: [249, 74, 56, 56],
  B: [180, 120, 56, 56],
  L: [0, 2, 108, 30],
  R: [212, 2, 108, 30],
  Select: [125, 215, 17, 17],
  Start: [181, 215, 17, 17],
};
const mapAssets = {
  A: "iphone_a",
  B: "iphone_b",
  L: "iphone_l",
  R: "iphone_r",
  Start: "iphone_start_select",
  Select: "iphone_start_select",
};
function bindingLabel(name) {
  const codes = Object.keys(keys).filter((code) => keys[code] === name);
  return codes.length ? keyLabel(codes[0]) : "—";
}
function beginMapping(name) {
  releaseAll();
  captureKey = name;
  queryElement("#key-status").textContent =
    "Press a key for " + (name === "Fast" ? "fast-forward" : name) + " · Esc cancels";
  renderKeyBindings();
}
function renderKeyBindings() {
  renderPausedControls();
  const host = queryElement("#key-bindings");
  host.replaceChildren();
  const cross = document.createElement("div");
  cross.className = "map-cross";
  host.append(cross);
  const menuArt = document.createElement("span");
  menuArt.className = "map-menu-art";
  menuArt.setAttribute("aria-hidden", "true");
  host.append(menuArt);
  for (const [name, [x, y, w, h]] of Object.entries(mapFrames)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-button map-" + name.toLowerCase();
    button.style.cssText =
      "left:" +
      (x / 320) * 100 +
      "%;top:" +
      (y / 274) * 100 +
      "%;width:" +
      (w / 320) * 100 +
      "%;height:" +
      (h / 274) * 100 +
      "%;";
    if (mapAssets[name])
      button.style.backgroundImage = "url(assets/delta/" + mapAssets[name] + ".webp)";
    button.setAttribute("aria-label", "Map " + name + " key");
    button.classList.toggle("listening", captureKey === name);
    const cap = document.createElement("kbd");
    cap.textContent = captureKey === name ? "…" : bindingLabel(name);
    button.append(cap);
    button.onclick = () => beginMapping(name);
    host.append(button);
  }
  const fast = queryElement("#map-fast");
  fast.querySelector("kbd").textContent = captureKey === "Fast" ? "…" : bindingLabel("Fast");
  fast.classList.toggle("listening", captureKey === "Fast");
  fast.onclick = () => beginMapping("Fast");
}
function renderPausedControls() {
  for (const button of document.querySelectorAll<HTMLElement>("#deck [data-control]")) {
    let cap = button.querySelector(".paused-key");
    if (!cap) {
      cap = document.createElement("kbd");
      cap.className = "paused-key";
      cap.setAttribute("aria-hidden", "true");
      button.append(cap);
    }
    cap.textContent = bindingLabel(button.dataset.control);
  }
}
function selectMenuPane(name) {
  captureKey = null;
  renderKeyBindings();
  queryElement("#key-status").textContent = "M · sound · P · pause · Esc · menu";
  document.querySelectorAll<HTMLButtonElement>(".menu-tabs [data-pane]").forEach((button) => {
    const selected = button.dataset.pane === name;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    queryElement("#pane-" + button.dataset.pane).hidden = !selected;
  });
  queryElement("#menu-game-name").textContent = current?.name || "Tweetboy";
  if (current) queryElement("#menu-game-art").replaceChildren(createCartridgeElement(current));
  queryElement(".menu-content").scrollTop = 0;
}
function positionMenu() {
  const r = consoleElement.getBoundingClientRect();
  menu.style.setProperty("--menu-width", Math.min(380, r.width - 26) + "px");
  menu.style.setProperty("--menu-height", Math.max(120, r.height - 38) + "px");
  menu.style.setProperty("--menu-x", r.left + r.width / 2 + "px");
  menu.style.setProperty("--menu-y", r.top + r.height / 2 + "px");
}

function saveKeys() {
  try {
    localStorage.setItem("tweetboy.keys", JSON.stringify(keys));
  } catch {
    queryElement("#key-status").textContent = "This browser cannot save your layout.";
  }
}
window.addEventListener(
  "keydown",
  (event) => {
    if (!captureKey) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.code === "Escape") {
      captureKey = null;
      queryElement("#key-status").textContent = "Mapping cancelled.";
      renderKeyBindings();
      return;
    }
    if (
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      !/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Enter|NumpadEnter|Backspace|Space|Shift(Left|Right)|Bracket(Left|Right)|Comma|Period|Slash|Semicolon|Quote|Minus|Equal)queryElement/.test(
        event.code,
      ) ||
      ["KeyM", "KeyP", "Tab", "MetaLeft", "MetaRight"].includes(event.code) ||
      !event.code
    ) {
      queryElement("#key-status").textContent = "That key is reserved. Choose another key.";
      return;
    }
    const action = captureKey;
    const previous = keys[event.code];
    for (const code of Object.keys(keys)) if (keys[code] === action) delete keys[code];
    keys[event.code] = action;
    captureKey = null;
    saveKeys();
    renderKeyBindings();
    queryElement("#key-status").textContent =
      action +
      " → " +
      keyLabel(event.code) +
      (previous && previous !== action ? " · " + previous + " was unassigned." : "");
  },
  true,
);

let frame: HTMLIFrameElement = null;
let currentURL: string = null;
let current: Cartridge = null;
let ready = false;
let loading = false;
let loadTimer = 0;
let request = 0;
let bootShownAt = performance.now();
let firstBoot = true;
let bootTimer = 0;
let wakeTimer = 0;
let toastTimer = 0;
let paused = false;
let pauseReason = "";
let muted = true;
let soundChosen = false;
let engaged = false;
let waking = false;
let storageOK = true;
const held = new Map();
const pointers = new Map();
const swallowed = new Set();
const flushing = new Map();

function send<K extends keyof CommandData>(type: K, data: CommandData[K] = {} as CommandData[K]) {
  frame?.contentWindow?.postMessage({ type, ...data }, location.origin);
}
function unlockAudio() {
  try {
    frame?.contentWindow?.PocketAudioResume?.();
  } catch {}
}
function flush() {
  if (!ready) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const id = ++request;
    flushing.set(id, resolve);
    send("flush", { request: id });
    setTimeout(() => {
      flushing.delete(id);
      resolve();
    }, 3000);
  });
}

function toast(text, ms = 3200) {
  toastElement.textContent = text;
  toastElement.classList.add("show");
  clearTimeout(toastTimer);
  const note = queryElement("#save-note");
  if (menu.open) {
    note.dataset.text ??= note.textContent;
    note.textContent = text;
  }
  toastTimer = setTimeout(() => {
    toastElement.classList.remove("show");
    if (note.dataset.text) {
      note.textContent = note.dataset.text;
      delete note.dataset.text;
    }
  }, ms);
}

function render() {
  consoleElement.classList.toggle("is-ready", ready);
  consoleElement.classList.toggle("is-booting", !ready);
  consoleElement.classList.toggle("is-paused", ready && paused);
  const pauseKey = queryElement("#pause");
  pauseKey.disabled = !ready;
  pauseKey.setAttribute("aria-label", paused ? "Resume" : "Pause");
  pauseKey.querySelector("use").setAttribute("href", paused ? "#i-play" : "#i-pause");
  queryElement("#reset").disabled = !ready;
  const showPause = ready && paused && pauseReason !== "menu";
  veil.hidden = !(showPause || (waking && ready));
  consoleElement.classList.toggle("show-control-keys", showPause);
  queryElement("#veil-title").textContent = showPause ? "Paused" : "Tap to wake";
  queryElement("#veil-hint").textContent = showPause
    ? coarse
      ? "Tap or press any button"
      : "Click or press any key"
    : embed
      ? "Sound stays off until you turn it on"
      : "Tap the screen to start";
  const focused = document.hasFocus();
  consoleElement.classList.toggle("has-focus", focused);
  queryElement("#keys-hint").textContent = focused ? "⌨ Keys on" : "⌨ Click for keys";
}
function renderSound() {
  soundKey.setAttribute("aria-pressed", String(!muted));
  soundKey.setAttribute("aria-label", muted ? "Turn sound on" : "Turn sound off");
  soundKey.querySelector("use").setAttribute("href", muted ? "#i-sound-off" : "#i-sound-on");
  soundKey.querySelector("span").textContent = muted ? "Sound off" : "Sound on";
  soundKey.querySelector("span").hidden = false;
  if (!muted) soundKey.classList.remove("nudge");
}
function setMuted(value, explicit = false) {
  muted = value;
  if (explicit) soundChosen = true;
  if (ready) send("mute", { muted });
  if (!muted) unlockAudio();
  renderSound();
}

function pause(reason) {
  if (paused) {
    if (reason === "user") pauseReason = "user";
    render();
    return;
  }
  paused = true;
  pauseReason = reason;
  releaseAll();
  if (ready) send("pause");
  render();
}
function resume() {
  if (!paused) return;
  paused = false;
  pauseReason = "";
  waking = false;
  if (ready) send("resume");
  render();
}
// Before the player touches anything, the console behaves like an attract loop and wakes itself back up.
function autoResume() {
  if (paused && !engaged && !menu.open && ["blur", "hidden", "offscreen"].includes(pauseReason))
    resume();
}
function engage() {
  unlockAudio();
  if (waking) {
    waking = false;
    render();
  }
  if (engaged) return;
  engaged = true;
  if (!soundChosen) {
    if (embed) soundKey.classList.add("nudge");
    else setMuted(false);
  }
}

/* ---------- Cartridges ---------- */
function createCartridgeElement(game: Cartridge) {
  const cart = document.createElement("span");
  cart.className = "cart sys-" + game.sys.toLowerCase();
  const label = document.createElement("span");
  label.className = "cart-label art-" + game.art;
  label.innerHTML =
    '<svg viewBox="0 0 48 30" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
    ART[game.art] +
    "</svg>";
  const name = document.createElement("b");
  name.textContent = game.label;
  label.append(name);
  cart.append(label);
  return cart;
}
function buildShelf() {
  const insertSlot = queryElement("#insert");
  document.querySelectorAll<HTMLButtonElement>(".slot[data-slug]").forEach((slot) => slot.remove());
  for (const game of getCartridges()) {
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "slot";
    slot.dataset.slug = game.slug;
    const title = document.createElement("b");
    title.textContent = game.name;
    const meta = document.createElement("small");
    meta.textContent = game.sys + " · " + game.genre;
    slot.append(createCartridgeElement(game), title, meta);
    slot.onclick = () => {
      closeMenu();
      loadCartridge(game);
    };
    insertSlot.before(slot);
  }
}
function markShelf() {
  document.querySelectorAll<HTMLButtonElement>(".slot[data-slug]").forEach((slot) => {
    const game = getCartridges().find((game) => game.slug === slot.dataset.slug);
    slot.classList.toggle("current", game.slug === current?.slug);
    slot.classList.toggle("missing", !!game.missing);
    slot.disabled = !!game.missing;
    slot.querySelector("small").textContent = game.missing
      ? "Not installed"
      : game.sys + " · " + game.genre;
  });
}

/* ---------- Boot screen ---------- */
function showLoadingScreen(game: Cartridge) {
  clearTimeout(bootTimer);
  boot.classList.remove("done", "error");
  queryElement("#boot-action").hidden = true;
  queryElement("#boot-cart").replaceChildren(createCartridgeElement(game));
  queryElement("#boot-title").textContent = game.name;
  bootProgress(0.04, "Reading cartridge");
  bootShownAt = performance.now();
}
function bootProgress(value, text?: string) {
  queryElement("#boot-bar").style.setProperty("--p", Math.round(value * 100) + "%");
  if (text) queryElement("#boot-status").textContent = text;
}
function hideBoot() {
  const min = firstBoot ? 1100 : 450;
  firstBoot = false;
  clearTimeout(bootTimer);
  bootTimer = setTimeout(
    () => boot.classList.add("done"),
    Math.max(0, min - (performance.now() - bootShownAt)),
  );
}
function bootError(text) {
  boot.classList.remove("done");
  boot.classList.add("error");
  queryElement("#boot-status").textContent = text;
  queryElement("#boot-action").hidden = false;
}

async function readCartridgeBytes(game: Cartridge) {
  if (game.localId) {
    const record = (await libraryRead(game.localId)) as LibraryRecord;
    if (!record) throw Error("This ROM is no longer saved. Import it again.");
    return record.blob.arrayBuffer();
  }
  const response = await fetch("roms/" + game.rom);
  if (!response.ok) {
    const error = Error(
      response.status === 404
        ? game.name + " isn’t installed here."
        : "Could not read " + game.name + ".",
    ) as Error & { missing?: boolean };
    error.missing = response.status === 404;
    throw error;
  }
  const total = Number(response.headers.get("content-length")) || 0;
  if (!response.body || !total) return response.arrayBuffer();
  const reader = response.body.getReader();
  const bytes = new Uint8Array(total);
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (received + value.length > total)
      return new Response(new Blob([bytes.subarray(0, received), value])).arrayBuffer();
    bytes.set(value, received);
    received += value.length;
    bootProgress(0.04 + (received / total) * 0.66);
  }
  return bytes.buffer.slice(0, received);
}
function validateCartridgeHeader(ext, bytes) {
  if (ext !== "gba") {
    let check = 0;
    for (let i = 0x134; i <= 0x14c; i++) check = (check - bytes[i] - 1) & 255;
    if (check !== bytes[0x14d]) throw Error("That isn’t a valid Game Boy cartridge.");
  } else {
    let check = 0;
    for (let i = 0xa0; i <= 0xbc; i++) check = (check - bytes[i]) & 255;
    check = (check - 0x19) & 255;
    if (bytes[0xb2] !== 0x96 || check !== bytes[0xbd])
      throw Error("That isn’t a valid Game Boy Advance cartridge.");
  }
}

async function loadCartridge(game: Cartridge, file?: File) {
  if (loading) return;
  loading = true;
  showLoadingScreen(game);
  try {
    const data = file ? await file.arrayBuffer() : await readCartridgeBytes(game);
    const ext = (file ? file.name : game.rom).split(".").pop().toLowerCase();
    if (
      !["gb", "gbc", "gba"].includes(ext) ||
      data.byteLength < 0x150 ||
      data.byteLength > 32 * 1024 * 1024
    )
      throw Error("Choose a .gb, .gbc or .gba ROM up to 32 MB.");
    bootProgress(0.74, "Checking header");
    validateCartridgeHeader(ext, new Uint8Array(data));
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", data)))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    if (file) {
      try {
        game = await storeROM(file, hash, game);
      } catch {
        toast("Playing this ROM, but it could not be saved locally. Check browser storage.", 6000);
      }
    }
    bootProgress(0.84, "Powering core");
    releaseAll();
    await flush();
    clearTimeout(loadTimer);
    clearInterval(wakeTimer);
    frame?.remove();
    if (currentURL) URL.revokeObjectURL(currentURL);
    currentURL = URL.createObjectURL(file || new Blob([data]));
    current = game;
    try {
      if (game.slug) localStorage.setItem("tweetboy.last-game", game.slug);
    } catch {}
    ready = false;
    paused = false;
    pauseReason = "";
    waking = false;
    render();
    consoleElement.classList.toggle("gba", ext === "gba");
    consoleElement.classList.toggle("gbc", ext === "gbc");
    consoleElement.classList.toggle("rotated", !!game.rotation);
    queryElement("#slot-label").textContent = game.label.toUpperCase();
    queryElement("#model").textContent = { gba: "Advance", gbc: "Color", gb: "" }[ext];
    document.title = game.name + " · Tweetboy";
    markShelf();
    frame = document.createElement("iframe");
    frame.title = game.name + " screen";
    frame.tabIndex = -1;
    frame.allow = "autoplay; fullscreen";
    frame.src = "player.html?v=30";
    frame.onload = () => {
      // EmulatorJS's own "Click to resume" popup can't be clicked through this frame; the console shows its own wake veil.
      try {
        frame.contentDocument.head.insertAdjacentHTML(
          "beforeend",
          "<style>.ejs_popup_container{display:none!important}</style>",
        );
      } catch {}
      send("init", {
        url: currentURL,
        key: hash,
        core: ext === "gba" ? "mgba" : "gambatte",
        rotation: game.rotation || 0,
        muted,
        speed: gameSpeed,
      });
    };
    display.replaceChildren(frame);
    loadTimer = setTimeout(() => {
      if (!ready) {
        loading = false;
        bootError("The cartridge didn’t start.");
      }
    }, 25000);
  } catch (error) {
    loading = false;
    if (error.missing) {
      game.missing = true;
      markShelf();
    }
    if (ready) {
      boot.classList.add("done");
      toast(error.message || "Could not load this cartridge.");
    } else bootError(error.message || "Could not load this cartridge.");
  }
}
function customGame(file: File): Cartridge {
  const name = file.name.replace(/\.(gb|gbc|gba)queryElement/i, "");
  return {
    name,
    label: name,
    art: "custom",
    sys: systemFromFilename(file.name) || "GB",
    genre: "Your ROM",
    custom: true,
  };
}

function watchWake() {
  clearInterval(wakeTimer);
  const started = performance.now();
  wakeTimer = setInterval(() => {
    let blocked = false;
    try {
      const doc = frame?.contentDocument;
      const fps = Number(doc?.body.dataset.emulationFps);
      blocked =
        fps === 0 &&
        Array.from(doc?.querySelectorAll(".ejs_popup_container") || []).some((el) =>
          el.textContent.includes("Click to resume Emulator"),
        );
    } catch {}
    if (blocked !== waking) {
      waking = blocked;
      render();
    }
    if (!blocked && performance.now() - started > 30000) clearInterval(wakeTimer);
  }, 500);
}

window.addEventListener("message", (event) => {
  if (event.source !== frame?.contentWindow || event.origin !== location.origin) return;
  const message = event.data as PlayerEvent;
  if (message.type === "started") {
    clearTimeout(loadTimer);
    ready = true;
    loading = false;
    send("speed", { speed: gameSpeed });
    if (!muted) send("mute", { muted: false });
    if (menu.open && !paused) {
      paused = true;
      pauseReason = "menu";
    }
    if (paused) send("pause");
    bootProgress(1, "Ready");
    hideBoot();
    render();
    watchWake();
  } else if (message.type === "notice") toast(message.message);
  else if (message.type === "error") {
    if (!ready) {
      loading = false;
      clearTimeout(loadTimer);
      bootError(message.message);
    } else toast(message.message, 4500);
  } else if (message.type === "flushed") {
    flushing.get(message.request)?.();
    flushing.delete(message.request);
  }
});

/* ---------- Controls: multitouch zones ---------- */
function input(name, on, source) {
  const set = held.get(name) || new Set();
  const was = set.size > 0;
  if (on) set.add(source);
  else set.delete(source);
  held.set(name, set);
  const now = set.size > 0;
  if (was === now) return;
  if (ready && !paused) send("input", { index: mapping[name], value: now ? 1 : 0 });
  document
    .querySelectorAll(`[data-control="${name}"]`)
    .forEach((el) => el.classList.toggle("pressed", now));
  if (["Up", "Down", "Left", "Right"].includes(name)) tilt();
}
function isHeld(name) {
  return (held.get(name)?.size || 0) > 0;
}
function tilt() {
  dpad.style.setProperty(
    "--tx",
    ((isHeld("Right") ? 1 : 0) - (isHeld("Left") ? 1 : 0)) * 9 + "deg",
  );
  dpad.style.setProperty("--ty", ((isHeld("Up") ? 1 : 0) - (isHeld("Down") ? 1 : 0)) * 9 + "deg");
}
function releaseAll() {
  for (const [name, set] of held)
    if (set.size && ready) send("input", { index: mapping[name], value: 0 });
  held.clear();
  pointers.clear();
  document.querySelectorAll(".pressed").forEach((el) => el.classList.remove("pressed"));
  tilt();
}
function zoneHits(zone, x, y) {
  const hits = new Set();
  if (zone.dataset.zone === "dpad") {
    const r = zone.getBoundingClientRect();
    const dx = ((x - r.left) / r.width) * 2 - 1;
    const dy = ((y - r.top) / r.height) * 2 - 1;
    const d = Math.hypot(dx, dy);
    if (d < 0.18 || d > 1.7) return hits;
    // 60° per cardinal so diagonals need intent (30° wedges), and sliding the thumb never loses the pad.
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const near = (t) => Math.abs(((angle - t + 540) % 360) - 180) < 60;
    if (near(0)) hits.add("Right");
    if (near(180)) hits.add("Left");
    if (near(90)) hits.add("Down");
    if (near(-90)) hits.add("Up");
  } else if (zone.dataset.zone === "ab") {
    const buttons = [...zone.querySelectorAll("[data-control]")].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        name: el.dataset.control,
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        r: el.offsetWidth / 2,
      };
    });
    const dist = (b) => Math.hypot(x - b.x, y - b.y);
    const [b, a] = buttons;
    for (const button of buttons) if (dist(button) < button.r * 1.15) hits.add(button.name);
    // Rolling a thumb between the two presses both, like on hardware.
    if (!hits.size && Math.hypot(x - (a.x + b.x) / 2, y - (a.y + b.y) / 2) < a.r * 0.75) {
      hits.add("A");
      hits.add("B");
    }
    if (!hits.size) {
      const nearest = dist(a) < dist(b) ? a : b;
      if (dist(nearest) < nearest.r * 1.9) hits.add(nearest.name);
    }
  } else {
    const r = zone.getBoundingClientRect();
    const message = 14;
    if (
      x > r.left - message &&
      x < r.right + message &&
      y > r.top - message &&
      y < r.bottom + message
    )
      hits.add(zone.dataset.control);
  }
  return hits;
}
function track(id, names) {
  const p = pointers.get(id);
  if (!p) return;
  for (const n of p.names) if (!names.has(n)) input(n, false, "p" + id);
  for (const n of names)
    if (!p.names.has(n)) {
      input(n, true, "p" + id);
      if (!embed && coarse)
        try {
          navigator.vibrate?.(6);
        } catch {}
    }
  p.names = names;
}
function endPointer(id) {
  if (!pointers.has(id)) return;
  track(id, new Set());
  pointers.delete(id);
}
document.querySelectorAll<HTMLElement>("[data-zone]").forEach((zone) => {
  zone.addEventListener("pointerdown", (event) => {
    if (event.button > 0) return;
    event.preventDefault();
    engage();
    if (paused && ready && !menu.open) {
      resume();
      return;
    }
    try {
      zone.setPointerCapture(event.pointerId);
    } catch {}
    pointers.set(event.pointerId, { zone, type: event.pointerType, names: new Set() });
    track(event.pointerId, zoneHits(zone, event.clientX, event.clientY));
  });
  zone.addEventListener("pointermove", (event) => {
    if (pointers.get(event.pointerId)?.zone === zone)
      track(event.pointerId, zoneHits(zone, event.clientX, event.clientY));
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"] as const)
    zone.addEventListener(type, (event) => endPointer(event.pointerId));
  zone.addEventListener("contextmenu", (event) => event.preventDefault());
});
// Native keyboard activation of the physical buttons also plays the game.
document.querySelectorAll<HTMLButtonElement>("[data-control]").forEach((button) =>
  button.addEventListener("click", (event) => {
    if (event.detail !== 0) return;
    engage();
    if (paused && ready) {
      resume();
      return;
    }
    const name = button.dataset.control;
    const source = "activate:" + name;
    input(name, true, source);
    setTimeout(() => input(name, false, source), 80);
  }),
);
for (const type of ["pointerup", "pointercancel"] as const)
  window.addEventListener(type, (event) => endPointer(event.pointerId), true);
// iOS can drop pointerup when a gesture is interrupted; no touches left means nothing can still be held.
for (const type of ["touchend", "touchcancel"] as const)
  window.addEventListener(
    type,
    (event) => {
      if (!event.touches.length)
        for (const [id, p] of pointers) if (p.type === "touch") endPointer(id);
    },
    { capture: true, passive: true },
  );

/* ---------- Keyboard (only reaches us once the embed is focused) ---------- */
window.addEventListener("keydown", (event) => {
  unlockAudio();
  if (menu.open || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target as Element;
  if (target.closest?.("input,textarea,select,[contenteditable]")) return;
  if (event.code === "Escape") {
    event.preventDefault();
    openMenu();
    return;
  }
  if (event.code === "KeyM" && !event.repeat) {
    setMuted(!muted, true);
    return;
  }
  if (event.code === "KeyP" && !event.repeat && ready) {
    paused ? resume() : pause("user");
    return;
  }
  const name = keys[event.code];
  if (!name) return;
  if (/Enter/.test(event.code) && target.closest?.("button,a,summary")) return;
  event.preventDefault();
  if (event.repeat) return;
  engage();
  if (paused && ready) {
    resume();
    swallowed.add(event.code);
    return;
  }
  input(name, true, "k:" + event.code);
});
window.addEventListener("keyup", (event) => {
  if (swallowed.delete(event.code)) return;
  const name = keys[event.code];
  if (name) input(name, false, "k:" + event.code);
});

/* ---------- Chrome ---------- */
document.addEventListener(
  "pointerdown",
  (event) => {
    unlockAudio();
    if (embed && event.pointerType !== "touch" && !document.hasFocus()) window.focus();
  },
  true,
);
soundKey.onclick = () => {
  setMuted(!muted, true);
  soundKey.classList.remove("nudge");
};
queryElement("#pause").onclick = () => {
  if (menu.open) {
    closeMenu();
    if (ready) resume();
  } else if (ready) paused ? resume() : pause("user");
};
veil.onclick = () => {
  engage();
  if (paused) resume();
  else {
    waking = false;
    render();
  }
};
queryElement("#library").onclick = () => openMenu();
queryElement("#boot-action").onclick = () => openMenu("game");
queryElement("#close-menu").onclick = () => closeMenu();
function openMenu(pane = "game") {
  selectMenuPane(pane);
  positionMenu();
  if (menu.open) return;
  releaseAll();
  if (ready && !paused) pause("menu");
  markShelf();
  if (menu.showModal) menu.showModal();
  else menu.setAttribute("open", "");
}
function closeMenu() {
  if (menu.close) menu.close();
  else {
    menu.removeAttribute("open");
    menu.dispatchEvent(new Event("close"));
  }
}
menu.addEventListener("close", () => {
  if (menu.classList.contains("is-onboarding")) {
    try {
      localStorage.setItem("tweetboy.controls-seen", "1");
    } catch {}
    menu.classList.remove("is-onboarding");
    queryElement("#start-playing").hidden = true;
    queryElement("#controls-intro").hidden = true;
    queryElement(".control-instruction").hidden = false;
  }
  captureKey = null;
  renderKeyBindings();
  if (pauseReason === "menu") resume();
});
menu.addEventListener("click", (event) => {
  if (event.target === menu) closeMenu();
});
queryElement("#insert").onclick = () => queryElement("#rom").click();
queryElement("#rom").onchange = (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (file) {
    closeMenu();
    loadCartridge(customGame(file), file);
  }
};
queryElement("#reset").onclick = () => {
  releaseAll();
  send("reset");
  toast("Game reset");
};
const fullscreenKey = queryElement("#fullscreen");
fullscreenKey.hidden = !(document.fullscreenEnabled || document.webkitFullscreenEnabled);
fullscreenKey.onclick = async () => {
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement)
      await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else
      await (
        document.documentElement.requestFullscreen ||
        document.documentElement.webkitRequestFullscreen
      ).call(document.documentElement);
  } catch {
    toast("Fullscreen isn’t available here.");
  }
};
window.addEventListener("dragover", (event) => event.preventDefault());
window.addEventListener("drop", (event) => {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if (file) {
    closeMenu();
    loadCartridge(customGame(file), file);
  }
});

/* ---------- Lifecycle: never leave a button held or a hidden game running ---------- */
window.addEventListener("blur", () => {
  releaseAll();
  if (engaged && ready) pause("blur");
  render();
});
window.addEventListener("focus", () => {
  autoResume();
  render();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    releaseAll();
    pause("hidden");
  } else autoResume();
});
window.addEventListener("pagehide", releaseAll);
if ("IntersectionObserver" in window)
  new IntersectionObserver(
    ([entry]) => {
      if (entry.intersectionRatio < 0.25) {
        if (!paused) {
          releaseAll();
          pause("offscreen");
        }
      } else autoResume();
    },
    { threshold: [0, 0.25, 0.5] },
  ).observe(consoleElement);

async function probeStorage() {
  try {
    if (!window.indexedDB) throw Error();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("tweetboy-probe");
      request.onsuccess = () => {
        request.result.close();
        indexedDB.deleteDatabase("tweetboy-probe");
        resolve();
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => resolve();
    });
  } catch {
    storageOK = false;
    queryElement("#save-note").textContent =
      "This browser is blocking storage here, so saves won’t persist. Play still works.";
    render();
    toast("Saves are off in this browser context", 4500);
  }
}

/* ---------- Power on ---------- */
queryElement("#cartridge-slot").onclick = () => openMenu("game");
queryElement("#keyboard-shortcut").onclick = () => openMenu("controls");
document.querySelectorAll<HTMLButtonElement>(".menu-tabs [data-pane]").forEach((button) => {
  button.onclick = () => selectMenuPane(button.dataset.pane);
  button.onkeydown = (event) => {
    const tabs = [...document.querySelectorAll<HTMLButtonElement>(".menu-tabs [data-pane]")];
    let index = tabs.indexOf(button);
    if (event.key === "ArrowRight") index = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") index = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") index = 0;
    else if (event.key === "End") index = tabs.length - 1;
    else return;
    event.preventDefault();
    selectMenuPane(tabs[index].dataset.pane);
    tabs[index].focus();
  };
});
window.addEventListener("resize", () => {
  if (menu.open) positionMenu();
});
queryElement("#start-playing").onclick = () => closeMenu();
queryElement("#reset-keys").onclick = () => {
  releaseAll();
  keys = { ...defaultKeys };
  captureKey = null;
  saveKeys();
  renderKeyBindings();
  queryElement("#key-status").textContent = "Default keys restored.";
};
queryElement("#cartridge-slot").title = "Switch cartridges";
buildShelf();
renderKeyBindings();
renderSound();
render();
async function bootLibrary() {
  await restoreLibrary();
  let last;
  try {
    last = localStorage.getItem("tweetboy.last-game");
  } catch {}
  const routeGame = location.pathname.match(/^\/(?:r|play)\/([a-z0-9-]+)\/?queryElement/)?.[1];
  const requested =
    GAMES.find((game) => game.slug === (routeGame || params.get("game"))) ||
    getCartridges().find((game) => game.slug === last) ||
    localGames[0];
  if (!requested) {
    queryElement("#boot-title").textContent = "Insert a cartridge";
    queryElement("#boot-status").textContent = "Choose your own .gb, .gbc, or .gba file.";
    queryElement("#boot-action").hidden = false;
    probeStorage();
    return;
  }
  showLoadingScreen(requested);
  if (!window.WebAssembly) bootError("This browser can’t run the emulator.");
  else if (!window.crypto?.subtle) bootError("Open Tweetboy over HTTPS or localhost to play.");
  else {
    loadCartridge(requested);
    probeStorage();
  }
}
bootLibrary();

// Show the controller once on desktop, without changing touch-only play.
if (matchMedia("(hover:hover) and (pointer:fine)").matches) {
  let seen = false;
  try {
    seen = localStorage.getItem("tweetboy.controls-seen") === "1";
  } catch {}
  if (!seen) {
    menu.classList.add("is-onboarding");
    queryElement("#controls-intro").hidden = false;
    queryElement(".control-instruction").hidden = true;
    queryElement("#start-playing").hidden = false;
    openMenu("controls");
  }
}
