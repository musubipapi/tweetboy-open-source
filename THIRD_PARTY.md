# License and third-party notices

Tweetboy’s own code and adapted controller artwork use **AGPL-3.0-only**. See [LICENSE](LICENSE). Third-party materials retain their own licenses.

- [EmulatorJS 4.2.3](https://github.com/EmulatorJS/EmulatorJS/tree/v4.2.3): an external GPL-3.0 dependency supplied by the official CDN.
- Controller skin: adapted from [GBADeltaCore](https://github.com/rileytestut/GBADeltaCore), commit `869c34aeca9dd2b3fbd329092bb2743b0ae80c98`. Original PDFs, input geometry, and rendering code are in `tools/delta-skin/`. The artwork is AGPL-3.0. Preserve its license and attribution.
- Gambatte/mGBA: external emulator cores supplied by the CDN. If you self-host binaries, verify their corresponding source, build versions, and license notices before redistribution.
- `public/preview.png` and `public/preview.svg`: original console illustrations. They contain no game screenshots. `tools/render-preview.py` generates the PNG with Pillow.

The adapted source archive is `public/licenses/tweetboy-source.zip`. Games & credits links to this archive. Regenerate it with `python3 tools/build-release.py` after changing the app. To render the controller artwork, you need Pillow, NumPy, and `pdftocairo`. Normal gameplay does not require these tools.

No commercial games or game screenshots are included. Game Boy and related names belong to their respective owners. This project is not affiliated with Nintendo. Import only cartridges you have permission to use.
