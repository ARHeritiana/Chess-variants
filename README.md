# Chess Variants (Android)

WebView app: the game lives in `app/src/main/assets/www/` (index.html, css/, js/, fonts/).
Native bits (`MainActivity.java`): keep-screen-on, vibration, fullscreen, status-bar colour per theme, clipboard, back button.

- **Themes** (`js/theme.js` data, `css/themes.css` variants): four, and each is a whole design language, not a palette: colours, typefaces, menu style (bottom sheet, side drawer, drop-down, full-screen), buttons, tabs, toolbar, motion, sounds **and the piece set**.
  | Theme | Look | Pieces | Menu |
  |---|---|---|---|
  | Classic | clean cards, green accent, follows the system light/dark setting | flat outlined (cburnett) | bottom sheet |
  | Heritage | paper, serif type, wooden board with grain | carved ivory and ebony (shaded cburnett) | side drawer |
  | Modern | hairlines, mono labels, orange accent, follows system light/dark | rounded geometric silhouettes | drop-down |
  | Neon | dark grid, glowing edges, scan-line beam | angular neon outlines | full screen |
- **Pieces** (`js/pieces.js`, `js/pieces-classic.js`): SVG sets drawn to the canvas from cached images. `tools/gen_pieces.py` regenerates the classic artwork from python-chess (cburnett, see `NOTICE`). The round and angular sets are drawn in `pieces.js`. A theme picks its set with `pc.set`.
- **Playing**: tap-tap or drag-and-drop (a touch drag lifts the piece above the finger), legal-move hints, last-move and check highlights, promotion picker (or auto-queen), take back, resign, draw by agreement/claim, hints (Stockfish on Classical, the built-in engine elsewhere), board coordinates, flip board, captured pieces and material count, clocks with increment.
- **Browsing**: the move list is tappable; ⏮ ◀ ▶ ⏭ (or the arrow keys, Home/End) step through the game while it is still being played.
- **After a game**: result card with Rematch (colours swap), Review and New game. Finished games are archived (last 40, `cos_hist`) under Game > Saved games, and reopen into the browser/review.
- **Import**: Game > Import takes a PGN (comments, variations and NAGs are skipped; coordinate moves work too; a `[Variant]` tag selects the surface) or a FEN to play from a position. A game in progress survives the app being closed or killed (`cos_game`).
- Build: `./build.sh` (needs aapt, apksigner, zipalign, dalvik-exchange, android-sdk-platform-23, a JDK). Outputs `ChessVariants.apk`.
- The APK is signed with a self-generated key (`release.keystore`, created on first build, **not** in the repository). Run `KS_PASS=<password> ./build.sh`, and keep the keystore and password safe to install future updates over the same app.
- Settings, the game in progress and saved games are stored in the WebView's localStorage (`cos_*` keys).
- Tests: `node tools/app-tests/replay.js` (save/restore, FEN start, undo) and the engine suites below. To try the UI in a desktop browser, serve `app/src/main/assets/www` with any static server (for example `python3 -m http.server -d app/src/main/assets/www`).

## Maia opponent (Classical surface only)
- `www/js/maia.js` runs [Maia](https://maiachess.com) (lc0-format nets, 6 blocks x 64 filters, SE) in plain JS: no native code, no network. It plays by sampling the policy head over the legal moves (temperature 1, top-95% nucleus), so it makes human-like mistakes. No search.
- Weights: `www/maia/maia-{1100,1500,1900}.bin` (BN-folded fp16, ~1.2 MB each) + `maia-map.json` (lc0 policy tables). Source nets: `maia_weights/*.pb.gz` in github.com/CSSLab/maia-chess.
- `tools/convert.py` regenerates the .bin files from the .pb.gz nets (needs lczero-training's `net.proto`, `policy_index.py`, `lc0_az_policy_map.py`, protobuf, numpy). Any other Maia level (1200-1800) works the same; add it to `MAIAS`/`OPS` in app.js.
- Maia is trained on standard chess, so on Cylinder / Bounce surfaces the opponent falls back to the built-in engine (Maia buttons are disabled there).

## Stockfish and game review
- **Opponent**: New game > Play against > Maia (default, 1500) | Stockfish | Built-in | Two players. Stockfish levels are UCI_Elo limits (1500/2000/2500) plus Max (full strength). Maia and Stockfish need the Classical surface; on Cylinder/Bounce the built-in engine plays.
- **Stockfish 19 lite (single-thread WASM, GPL-3)** lives in `www/js/sf/` and runs in a Web Worker (`js/sf.js` is the wrapper). `MainActivity` serves `.wasm` as `application/wasm`, which the streaming loader requires. Source/licence: github.com/nmrugg/stockfish.js, `js/sf/COPYING.txt`.
- **Game review** (Game > Review game, the result card, or Library > Review on a saved game; works on any game with moves, not only finished ones). Every position is analysed, then each move is graded by the win probability it gave away: Best, Excellent, Good, Inaccuracy (5-10%), Mistake (10-20%), Blunder (20%+). Accuracy uses the Lichess formula. Engines: Stockfish (default; Fast/Standard/Deep = 250/600/1500 ms per position), Maia 1100/1500/1900 (value head win/draw/loss + "how many players of this rating would play it" + exact mate-in-1 check, because Maia has no search), and the built-in engine on the variant surfaces.
  - **Summary**: accuracy for both sides, the evaluation graph, how many moves of each grade each side played, and a list of key moments (mistakes and blunders) that jump into the walkthrough.
  - **Walkthrough**: step through the game with Next/Previous (or the move list, the graph, the arrow keys). Each move gets a grade badge on the board, the evaluation, a plain-language verdict, the engine's better move as a green arrow (the move actually played as a red one for mistakes and blunders), the best line, and a vertical eval bar beside the board. "Mistake" buttons jump between the critical moments.
  - Analyses are cached per game and, for saved games, stored with the game, so reopening a review is instant.
- `www/js/review.js` holds all review logic and drives the same move browser as normal play (`viewTo`); `maia/*.bin` also contain Maia's value head (regenerate with `tools/convert.py`).

## Menu
Four tabs: **Play** (surface, opponent, level, side, time control), **Game** (review, draw, copy PGN/FEN), **Library** (saved games, import) and **Settings** (appearance, board, sound, screen). Maia and Stockfish only play standard chess, so they are not offered at all on Cylinder and Bounce; on Classical you pick Maia, Stockfish or the built-in engine and then its level.

## Threads
Nothing heavy runs on the UI thread: Stockfish (`js/sf.js`), the built-in engine (`js/engine-worker.js`, used through `Eng.searchAsync`) and Maia (`js/maia-worker.js`, used through `js/maia-proxy.js`) each run in a Web Worker, so the board, animations and Back button stay responsive while the computer thinks. If a worker cannot start the same code runs on the UI thread. If Stockfish crashes or stops answering, its worker is replaced and the search retried once; starting a new game cancels any search in progress.

## Built-in engine (`engine-rs/` Rust → WebAssembly, `www/js/engine.js` JS fallback)
Rewritten for speed and strength on all four surfaces (Classical, Cylinder, Bounce sides, Bounce all): mailbox board with per-surface precomputed ray/knight/king/pawn tables that mirror `step()`/`adv()` exactly, make/unmake, Zobrist hashing, typed-array transposition table, PVS with aspiration windows, reverse futility, futility/late-move pruning, LMR, killers + history, check extensions, quiescence with check evasions, and an evaluation with surface-normalised mobility, king-zone attacks, pawn structure, passed pawns and rook activity. About 250k nodes/s in Node.
- Null-move pruning is disabled on Cylinder (wrap-around makes it unsound: 65% -> 97% score vs the old engine at 100 ms/move).
- Rules are verified against the app's own move generator: `tools/engine-tests/test_gen.js` (0 mismatches over ~19k random positions plus perft, all surfaces). `match.js <mode> <openings> <ms>` plays it against the old engine (`app.old.js`). At 100 ms/move the new engine scored 85% Classical, 97% Cylinder (after the null-move fix), 98% Bounce-sides, 85% Bounce-all; at 400 ms the margin is smaller (Cylinder 69% over a small sample).
- Levels: easy = depth 2 + noise, medium = depth 5 + small noise, hard = iterative deepening up to 3.5 s (less when the clock is low).
- **Strength** (Classical, against Stockfish limited with UCI_Elo, 24 games each, `tools/engine-tests/vs_sf.js`; Stockfish's Elo scale is only approximate at these short time controls): the engine at 1 s per move scored 83% against 1500, 79% against 2000 and 29% against 2500 (about 1800, 2200 and 2350, so roughly 2200 overall). The app's levels: **hard** (3.5 s) scored 20/24 against Stockfish 2000 (about 2280, 95% range 2130-2700); **easy** and **medium** lost all 24 games each against Stockfish at its weakest settings (1320 and 1500), so they cannot be placed on that scale and are described in words only. Variant surfaces have no reference opponent. Game review on variant surfaces uses 350 ms per position.

### Rust / WebAssembly engine (`engine-rs/`)
- `engine-rs/src/lib.rs` is a line-by-line port of `engine.js` to Rust (no dependencies, ~57 KB of WASM). Same rules tables, search, pruning and evaluation; plus a 2^20-entry transposition table (was 2^19) and an xorshift RNG for the move noise.
- `www/js/engine-wasm.js` loads `www/js/rs/engine.wasm` after startup and then swaps `Eng.search/legalMoves/perft/evalState` for the WASM versions. `engine.js` stays as the fallback: it plays until the module has loaded, and takes over again if WASM fails to load or traps (`Eng.engine` is `'rust-wasm'` or `'js'`).
- Rebuild: `engine-rs/build.sh` (rust + `wasm32-unknown-unknown` target, optional `wasm-opt`), then `./build.sh` for the APK. `.cargo/config.toml` pins an MVP-ish feature set (no bulk-memory) so older WebViews can still instantiate the module; sign-ext and mutable-globals (WebView 74+) are still used.
- Strength calibration: `node tools/engine-tests/vs_sf.js <sfElo> <games> <engMs> <sfMs> [workers]` plays the built-in engine against Stockfish (UCI_Elo limited) on Classical and prints an Elo estimate.
- Tests (Node): `tools/engine-tests/test_rs.js` (Rust move generation vs the original rules in `app.old.js`, perft, eval), `speed_rs.js` (nodes/s, JS vs Rust), `match_rs.js <mode> <openings> <ms>` (Rust vs JS at equal time per move).

## License
GPL-3.0-or-later (see `LICENSE`); third-party components are listed in `NOTICE`.
