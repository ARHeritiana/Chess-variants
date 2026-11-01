# Chess Variants (Android)

WebView app: the game lives in `app/src/main/assets/www/` (index.html, css/, js/, fonts/).
Native bits (`MainActivity.java`): keep-screen-on, vibration, fullscreen, status-bar colour per theme, clipboard, back button.

- Themes: `js/theme.js` (data) + `css/themes.css` (variants). A theme = fonts, shape, buttons, menu style, tabs, toolbar, motion, piece look, sounds.
- Build: `./build.sh` (needs aapt, apksigner, zipalign, dalvik-exchange, android-sdk-platform-23, a JDK). Outputs `ChessVariants.apk`.
- The APK is signed with a self-generated key (`release.keystore`, created on first build, **not** in the repository). Run `KS_PASS=<password> ./build.sh`, and keep the keystore and password safe to install future updates over the same app.
- Settings are stored in the WebView's localStorage (`cos_*` keys).

## Maia opponent (Classical surface only)
- `www/js/maia.js` runs [Maia](https://maiachess.com) (lc0-format nets, 6 blocks x 64 filters, SE) in plain JS: no native code, no network. It plays by sampling the policy head over the legal moves (temperature 1, top-95% nucleus), so it makes human-like mistakes. No search.
- Weights: `www/maia/maia-{1100,1500,1900}.bin` (BN-folded fp16, ~1.2 MB each) + `maia-map.json` (lc0 policy tables). Source nets: `maia_weights/*.pb.gz` in github.com/CSSLab/maia-chess.
- `tools/convert.py` regenerates the .bin files from the .pb.gz nets (needs lczero-training's `net.proto`, `policy_index.py`, `lc0_az_policy_map.py`, protobuf, numpy). Any other Maia level (1200-1800) works the same; add it to `MAIAS`/`OPS` in app.js.
- Maia is trained on standard chess, so on Cylinder / Bounce surfaces the opponent falls back to the built-in engine (Maia buttons are disabled there).

## Stockfish and game review
- **Opponent**: New game > Play against > Maia (default, 1500) | Stockfish | Built-in | Two players. Stockfish levels are UCI_Elo limits (1500/2000/2500) plus Max (full strength). Maia and Stockfish need the Classical surface; on Cylinder/Bounce the built-in engine plays.
- **Stockfish 19 lite (single-thread WASM, GPL-3)** lives in `www/js/sf/` and runs in a Web Worker (`js/sf.js` is the wrapper). `MainActivity` serves `.wasm` as `application/wasm`, which the streaming loader requires. Source/licence: github.com/nmrugg/stockfish.js, `js/sf/COPYING.txt`.
- **Game review** (button under the status line once a game ends, or Menu > Game): every position is analysed, then each move is graded by the win-probability it gave away (Best / Good / Inaccuracy 5-10% / Mistake 10-20% / Blunder 20%+). Accuracy uses the Lichess formula. Engines: Stockfish (default, depth 14 / 600 ms per position), Maia 1100/1500/1900 (value head win/draw/loss + "how many players of this rating would play it" + exact mate-in-1 check, because Maia has no search), and the built-in engine on variant surfaces. Results are cached per game and engine.
- `www/js/review.js` holds all review logic; `maia/*.bin` now also contain Maia's value head (regenerate with `tools/convert.py`).

## Built-in engine (`engine-rs/` Rust → WebAssembly, `www/js/engine.js` JS fallback)
Rewritten for speed and strength on all four surfaces (Classical, Cylinder, Bounce sides, Bounce all): mailbox board with per-surface precomputed ray/knight/king/pawn tables that mirror `step()`/`adv()` exactly, make/unmake, Zobrist hashing, typed-array transposition table, PVS with aspiration windows, reverse futility, futility/late-move pruning, LMR, killers + history, check extensions, quiescence with check evasions, and an evaluation with surface-normalised mobility, king-zone attacks, pawn structure, passed pawns and rook activity. About 250k nodes/s in Node.
- Null-move pruning is disabled on Cylinder (wrap-around makes it unsound: 65% -> 97% score vs the old engine at 100 ms/move).
- Rules are verified against the app's own move generator: `tools/engine-tests/test_gen.js` (0 mismatches over ~19k random positions plus perft, all surfaces). `match.js <mode> <openings> <ms>` plays it against the old engine (`app.old.js`). At 100 ms/move the new engine scored 85% Classical, 97% Cylinder (after the null-move fix), 98% Bounce-sides, 85% Bounce-all; at 400 ms the margin is smaller (Cylinder 69% over a small sample).
- Levels: easy = depth 2 + noise, medium = depth 5 + small noise, hard = iterative deepening up to 3.5 s (less when the clock is low). Game review on variant surfaces uses 350 ms per position.

### Rust / WebAssembly engine (`engine-rs/`)
- `engine-rs/src/lib.rs` is a line-by-line port of `engine.js` to Rust (no dependencies, ~57 KB of WASM). Same rules tables, search, pruning and evaluation; plus a 2^20-entry transposition table (was 2^19) and an xorshift RNG for the move noise.
- `www/js/engine-wasm.js` loads `www/js/rs/engine.wasm` after startup and then swaps `Eng.search/legalMoves/perft/evalState` for the WASM versions. `engine.js` stays as the fallback: it plays until the module has loaded, and takes over again if WASM fails to load or traps (`Eng.engine` is `'rust-wasm'` or `'js'`).
- Rebuild: `engine-rs/build.sh` (rust + `wasm32-unknown-unknown` target, optional `wasm-opt`), then `./build.sh` for the APK. `.cargo/config.toml` pins an MVP-ish feature set (no bulk-memory) so older WebViews can still instantiate the module; sign-ext and mutable-globals (WebView 74+) are still used.
- Tests (Node): `tools/engine-tests/test_rs.js` (Rust move generation vs the original rules in `app.old.js`, perft, eval), `speed_rs.js` (nodes/s, JS vs Rust), `match_rs.js <mode> <openings> <ms>` (Rust vs JS at equal time per move).

## License
GPL-3.0-or-later (see `LICENSE`); third-party components are listed in `NOTICE`.
