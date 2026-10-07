# Tweetboy

Tweetboy plays Game Boy, Game Boy Color, and Game Boy Advance games in a browser. The interface looks like a handheld console. You can use touch controls or a keyboard. The browser keeps imported cartridges and saves your progress. X Player Card metadata supplies the title, preview image, and embedded player URL.

This is a separate source-only edition of Tweetboy. Its Git history starts with one clean commit. No ROMs, game screenshots, or compiled emulator cores are included.

EmulatorJS 4.2.3 and its cores load from the official versioned CDN. Internet access is required for the emulator. Imported ROM bytes stay in your browser.

## Run locally

Use Python 3.11 or newer and Node.js 22 or newer. Install the TypeScript build dependency with `npm ci`.

```sh
git clone https://github.com/musubipapi/tweetboy-open-source.git
cd tweetboy-open-source
npm ci
npm start
```

Open [localhost:8765](http://127.0.0.1:8765/). `npm start` compiles TypeScript and starts the Python server. After a successful build, `python3 server.py` starts the server without compiling again.

On first load, select **Choose a cartridge → Your ROM**. Select a `.gb`, `.gbc`, or `.gba` file of up to 32 MiB. No games are preloaded. After you import a cartridge, Tweetboy can restore it on your next visit.

The browser stores imported files in IndexedDB. The server has no upload endpoint. Git ignores all `.gb`, `.gbc`, and `.gba` files. The release builder also excludes these files.

Use localhost or HTTPS. The player requires a secure browser context. Direct HTML files and plain HTTP on a phone’s LAN address do not supply this context.

## Controls and appearance

| Action | Default keys |
| --- | --- |
| Move | W / A / S / D |
| B / A | J / K |
| L / R | R / U |
| Select / Start | 1 / 2 |
| Fast-forward | Shift |
| Sound | M |
| Pause / resume | P |
| Menu | Escape |

Touch controls support diagonal movement on the D-pad. You can press A+B together. Keyboard input requires focus inside the player. When you pause, key labels appear over the console buttons.

The top cartridge slot opens the Game menu. In **Settings**, you can change the keyboard mappings. You can select Violet, Mint, Blue, Rose, Gold, or Slate. Select **Game speed** to use 1×, 1.5×, 2×, 3×, or 4× speed. The browser keeps the selected speed in localStorage. Hold Shift for temporary fast-forward at a minimum of 3×. Release Shift to return to the selected speed. Higher speeds can change sound and depend on device performance.

The browser keeps these preferences in localStorage. Desktop visitors see the keyboard guide once.

The game starts with sound off. In an embedded player, turn sound on in the menu. Outside embedded players, the console controls also turn sound on when you use them. The portrait console scales to fit phone, square, and wide display areas.

## Saving and privacy

- Imported cartridges are stored in IndexedDB `tweetboy-library`, keyed by their SHA-256 hash.
- The browser saves emulator snapshots every 30 seconds during play. It also saves when you pause, switch cartridges, or hide the page. Snapshots use `autosave:<ROM hash>` in IndexedDB `pocket-saves`.
- Loading the same ROM restores its latest snapshot. Older manual snapshots are used if no autosave exists.
- In-game battery saves persist separately through EmulatorJS.
- **Reset** clears the resume snapshot and restarts the cartridge while preserving in-game save files.

There is no account, cloud save service, or ROM upload API. Saves belong to the browser and website origin. An origin identifies a website by its protocol, host, and port. Embedded players may use separate browser storage. Progress does not transfer between domains, devices, or browsers. If you clear site data, you remove your progress. When the browser closes, it can interrupt the final save. The last completed snapshot may be up to 30 seconds behind. The player reports storage failures, but you can continue to play.

## Sharing and embedding

Share the root URL of your own deployment. The card opens the local cartridge library. Each visitor must import a cartridge in their own browser.

| Route | Purpose |
| --- | --- |
| `/` | Homepage and generic card metadata |
| `/r/library` | Library share page |
| `/play/library` | Dedicated iframe player |
| `/embed-preview.html` | Local feed preview with several card sizes |

Share pages return metadata in their initial HTML. Imported cartridges cannot be shared through these routes. The player accepts extra launch parameters such as `autoplay=1&auto_play=true`. These parameters do not grant audio permission.

```html
<iframe src="https://your-domain.example/play/library"
        width="600" height="600" style="border:0;border-radius:16px"
        allow="autoplay; fullscreen" allowfullscreen title="Tweetboy"></iframe>
```

The Player Card title is **Tweetboy - Play gameboy games right inside of X**. The title and thumbnail are server metadata and cannot reflect a viewer’s private browser save. The playable iframe can resume that viewer’s progress.

The `frame-ancestors` Content Security Policy (CSP) permits frames from Tweetboy, X, and Twitter. This policy also applies to the nested emulator frame. To embed on another site, add that site to `FRAME_POLICY` in `server.py`. Avoid conflicting framing headers at the hosting proxy.

This follows [X’s official Player Card sample](https://github.com/xdevplatform/cards-player-samples/blob/main/player/page.html). Correct metadata does not guarantee X accepts or displays an interactive game card. After you publish a link, check that X displays the card correctly.

## Configuration

Your shell or hosting environment supplies the variables. The server does not load `.env` files automatically.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PUBLIC_URL` | `http://127.0.0.1:8765` | Absolute origin for card assets and canonical URLs |
| `TWITTER_SITE` | Unset | Optional publisher handle, such as `@yourhandle` |
| `BIND_HOST` | `127.0.0.1` | Bind address; use `0.0.0.0` in a container |
| `PORT` | `8765` | Listening port |

`PUBLIC_URL` must be an HTTPS origin without a path, query, fragment, or credentials. HTTP is allowed only for localhost development. If you change `PORT` locally, set `PUBLIC_URL` to keep the share metadata accurate.

```sh
PUBLIC_URL=https://your-domain.example TWITTER_SITE=@yourhandle \
BIND_HOST=0.0.0.0 PORT=8080 python3 server.py
```

The Python server supplies the app files and generates card metadata. The emulator runs in the browser. It blocks dotfiles, directory listings, and symlinks outside `public/`. A static host can serve the console. Player Card routes need equivalent HTML generated in advance, URL routing, and framing headers. There is no offline cache or Progressive Web App (PWA) cache.

## Railway deployment

The included Dockerfile uses Python 3.12. Set `PUBLIC_URL` and `TWITTER_SITE` as service variables. Railway supplies `PORT`. Manage DNS and custom domains in Railway.

Build a release directory before you upload the app:

```sh
python3 tools/build-release.py
railway up work/release --path-as-root --no-gitignore \
  --project YOUR_PROJECT_ID --environment YOUR_ENVIRONMENT_ID \
  --service YOUR_SERVICE_ID --detach
```

The builder creates a new adapted source archive. It copies only the server, Docker configuration, and `public/` to the release directory. The deployment and source archive exclude ROMs. It excludes credential files from the release. Check the release contents before publishing your own installation.

No deployment includes bundled ROMs. `--detach` confirms the upload. It does not confirm deployment success. Check that the returned deployment ID reaches `SUCCESS`. Then check the HTTPS homepage, metadata, player, and assets.

## Development and checks

```sh
npm run build
npm test
```

`npm test` checks TypeScript types and runs the Python tests. `npm run typecheck` checks types without generating JavaScript. Tests use a temporary public directory and real HTTP requests. They require no commercial ROMs or external services. They cover homepage startup, card routes, metadata, HEAD requests, framing headers, origin validation, and private-file restrictions.

For browser checks, open `/embed-preview.html`. Check game startup, touch input, keyboard input, sound permission, pause, resume, and cartridge changes. Check automatic save restoration, saved color preferences, and storage failure messages.

| File | Responsibility |
| --- | --- |
| `src/app.ts` | Console UI, input, ROM library, settings, lifecycle |
| `src/player.ts` | Emulator configuration, snapshots, engine messages |
| `src/types.ts` | Cartridge, snapshot, and message types |
| `src/globals.d.ts` | EmulatorJS and browser compatibility declarations |
| `public/app.js`, `public/player.js`, `public/types.js` | Generated browser JavaScript |
| `public/style.css` | Handheld skin and menu |
| `server.py` | Static delivery, share metadata, framing policy |
| `tools/build-release.py` | Source offer and deployable release directory |
| `tools/delta-skin/` | Original controller artwork and rendering script |
| `tests/test_server.py` | HTTP integration checks |

Edit the files in `src/`. Run `npm run build` after each change. Do not edit the generated JavaScript directly. Generated files are committed so the static Docker image can start without Node.js. The release builder compiles TypeScript before creating the source archive. The compiler rejects known type errors before it generates output. Strict mode is not yet enabled for the full interface code.

EmulatorJS 4.2.3 and Gambatte/mGBA load from `https://cdn.emulatorjs.org/4.2.3/data/`. This repository does not redistribute their code or binaries. Keep the fixed 59.7275 Hz scheduling and audio configuration unless measurements show a regression that requires a change. The CDN supplies third-party code separately from app code.

## Secrets

No credentials are required for normal local play. Keep deployment tokens in your hosting environment or CLI credential store. `.gitignore`, `.railwayignore`, and `.dockerignore` exclude common credential files. Never put credentials in client code or `public/`.

For a repeatable secret check with [Gitleaks](https://github.com/gitleaks/gitleaks):

```sh
gitleaks git . --log-opts=--all --redact
```

The October 7, 2026 review found no secrets in tracked files, source archives, or the Git history. A scan reduces risk; it is not a guarantee that every possible credential format is detected.

## License and third-party notices

Tweetboy’s own code and adapted controller artwork use **AGPL-3.0-only**. See [LICENSE](LICENSE). Third-party materials retain their own licenses.

- [EmulatorJS 4.2.3](https://github.com/EmulatorJS/EmulatorJS/tree/v4.2.3): an external GPL-3.0 dependency supplied by the official CDN.
- Controller skin: adapted from [GBADeltaCore](https://github.com/rileytestut/GBADeltaCore), commit `869c34aeca9dd2b3fbd329092bb2743b0ae80c98`. Original PDFs, input geometry, and rendering code are in `tools/delta-skin/`. The artwork is AGPL-3.0. Preserve its license and attribution.
- Gambatte/mGBA: external emulator cores supplied by the CDN. If you self-host binaries, verify their corresponding source, build versions, and license notices before redistribution.
- `public/preview.png` and `public/preview.svg`: original console illustrations. They contain no game screenshots. `tools/render-preview.py` generates the PNG with Pillow.

The adapted source archive is `public/licenses/tweetboy-source.zip`. Games & credits links to this archive. Regenerate it with `python3 tools/build-release.py` after changing the app. To render the controller artwork, you need Pillow, NumPy, and `pdftocairo`. Normal gameplay does not require these tools.

No commercial games or game screenshots are included. Game Boy and related names belong to their respective owners. This project is not affiliated with Nintendo. Import only cartridges you have permission to use.
