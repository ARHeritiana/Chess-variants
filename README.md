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

## Phone layout and review

The app uses the available viewport width without a minimum-width board. Player strips, menus,
review controls and result buttons can wrap on narrow phones. The board retains its square
aspect ratio; review charts have their own fixed-height geometry and backing stores measured
at the displayed size. Charts redraw when shown or resized, and vertical swipes can scroll
past them.

Review includes a short comment for every move, covering captures, development, checks,
castling, promotion, changes in winning chances, and better moves from the selected engine.
The summary highlights each side's largest loss. Key-moment buttons jump in both directions
through inaccuracies, mistakes, blunders, changes in the favoured side, promotions and mating
moments. The move-by-move comments in the summary are tappable.

Two very small offline language models were evaluated on 24 explanation fixtures and rejected
for repetition, misleading wording and limited usefulness relative to their size and latency.
No model download is required. See [the evaluation and complete outputs](docs/coach-model-evaluation.md).

## Voice moves

Tap **Speak a move** on the live board. English examples: “knight to f3”, “e2 to e4”,
“castle kingside”, and “a7 to a8 promote to knight”. The app matches against legal moves,
shows ambiguous choices, and always asks for confirmation before playing. Results are rejected
if the game or position changed while listening. Voice input uses Android's installed speech
recognition activity; availability, internet needs and audio handling depend on that service.
In desktop browsers it uses Web Speech Recognition where available. Board input always works
without speech support.

## App updates and releases

The Android app checks the latest **public, stable GitHub release** at startup, on resume or
reconnection when due, and every 15 minutes while in the foreground. Settings also has a manual
check. An in-app banner offers **Download update** and **Later**. Download opens the browser;
Android's ordinary APK installer handles installation after the download. An installed older
build without the checker needs one manual upgrade first. No background service runs when the
app is closed.

Build with the **same release keystore** used for the installed app and an increasing integer
`VERSION_CODE`. The defaults are version 2.1, code 4. `build.sh` produces `ChessVariants.apk`
and `build/ChessVariants-4.apk`. Upload the latter to a published stable GitHub release:

```sh
VERSION_CODE=4 VERSION_NAME=2.1 KS_FILE=/path/to/existing/release.keystore KS_PASS_FILE=/path/to/password ./build.sh
# After checking the APK, publish a release with build/ChessVariants-4.apk attached.
```

The checker recognises `ChessVariants-<versionCode>.apk`; a release without such an asset is
not an update. Drafts and prereleases are excluded. Never publish an APK signed with a new
test key as an update for existing installations.

To use another host, change `app/src/main/res/values/updates.xml` to a public HTTPS manifest
URL returning `{ "package_name": "app.chessonsurfaces", "version_code": 4, "version_name": "2.1",
"url": "https://example.com/ChessVariants-4.apk" }`. No GitHub credentials are stored in the APK.

## UI and update regression tests

Run the existing save/restore checks with `node tools/app-tests/replay.js`. For browser checks,
install Playwright, serve the static app on localhost:8000, then run
`node tools/app-tests/mobile.js` (`APP_URL` and `CHROMIUM_PATH` can override the defaults).
This checks real Stockfish review, both chart geometries at DPR 3, eight viewport sizes in all
four themes and all menu tabs, voice parsing and confirmation, review cleanup, concise move
comments and update-banner controls.

The update-feed parser also has a standalone JVM test. With the standard `org.json` JAR available:

```sh
javac -cp /path/to/json.jar -d /tmp/chess-update-tests app/src/main/java/app/chessonsurfaces/UpdateManifest.java tools/app-tests/UpdateManifestTest.java
java -cp /tmp/chess-update-tests:/path/to/json.jar app.chessonsurfaces.UpdateManifestTest
```

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
Four tabs: **Play** (surface, opponent, level, side, time control), **Game** (review, draw, copy PGN/FEN), **Library** (saved games, import) and **Settings** (appearance, board, sound, screen). Maia and Stockfish only play standard chess, so they are not offered at all on Cylinder and Bounce, where the built-in engine is the opponent. On Classical you pick Maia, Stockfish or the built-in engine and then the level (for the built-in engine: how long it may think).

## Threads
Nothing heavy runs on the UI thread: Stockfish (`js/sf.js`), the built-in engine (`js/engine-worker.js`, used through `Eng.searchAsync`) and Maia (`js/maia-worker.js`, used through `js/maia-proxy.js`) each run in a Web Worker, so the board, animations and Back button stay responsive while the computer thinks. If a worker cannot start the same code runs on the UI thread. If Stockfish crashes or stops answering, its worker is replaced and the search retried once; starting a new game cancels any search in progress.

## Built-in engine (`engine-rs/` Rust → WebAssembly, `www/js/engine.js` JS fallback)
Rewritten for speed and strength on all four surfaces (Classical, Cylinder, Bounce sides, Bounce all): mailbox board with per-surface precomputed ray/knight/king/pawn tables that mirror `step()`/`adv()` exactly, make/unmake, Zobrist hashing, typed-array transposition table, PVS with aspiration windows, reverse futility, futility/late-move pruning, LMR, killers + history, check extensions, quiescence with check evasions, and an evaluation with surface-normalised mobility, king-zone attacks, pawn structure, passed pawns and rook activity. About 250k nodes/s in Node.
- Null-move pruning is disabled on Cylinder (wrap-around makes it unsound: 65% -> 97% score vs the old engine at 100 ms/move).
- Rules are verified against the app's own move generator: `tools/engine-tests/test_gen.js` (0 mismatches over ~19k random positions plus perft, all surfaces). `match.js <mode> <openings> <ms>` plays it against the old engine (`app.old.js`). At 100 ms/move the new engine scored 85% Classical, 97% Cylinder (after the null-move fix), 98% Bounce-sides, 85% Bounce-all; at 400 ms the margin is smaller (Cylinder 69% over a small sample).
- **Thinking time** instead of levels: the engine always searches as deep as it can within a time limit that you choose (1, 3, 10 or 30 s per move, default 3 s; less when the clock is low). More time means stronger play.
- **Benchmark** (`tools/engine-tests/vs_sf.js`, Classical, against Stockfish limited with UCI_Elo, 24 games per row, equal time per move): at 1 s the engine scored 83% against Stockfish 1500, 79% against 2000 and 29% against 2500; at 3.5 s it scored 20/24 against Stockfish 2000. Stockfish's own Elo scale is only approximate at these time controls, and the variant surfaces have no reference opponent.

### Rust / WebAssembly engine (`engine-rs/`)
- `engine-rs/src/lib.rs` is a line-by-line port of `engine.js` to Rust (no dependencies, ~57 KB of WASM). Same rules tables, search, pruning and evaluation; plus a 2^20-entry transposition table (was 2^19) and an xorshift RNG for the move noise.
- `www/js/engine-wasm.js` loads `www/js/rs/engine.wasm` after startup and then swaps `Eng.search/legalMoves/perft/evalState` for the WASM versions. `engine.js` stays as the fallback: it plays until the module has loaded, and takes over again if WASM fails to load or traps (`Eng.engine` is `'rust-wasm'` or `'js'`).
- Rebuild: `engine-rs/build.sh` (rust + `wasm32-unknown-unknown` target, optional `wasm-opt`), then `./build.sh` for the APK. `.cargo/config.toml` pins an MVP-ish feature set (no bulk-memory) so older WebViews can still instantiate the module; sign-ext and mutable-globals (WebView 74+) are still used.
- Strength calibration: `node tools/engine-tests/vs_sf.js <sfElo> <games> <engMs> <sfMs> [workers]` plays the built-in engine against Stockfish (UCI_Elo limited) on Classical and prints an Elo estimate.
- Tests (Node): `tools/engine-tests/test_rs.js` (Rust move generation vs the original rules in `app.old.js`, perft, eval), `speed_rs.js` (nodes/s, JS vs Rust), `match_rs.js <mode> <openings> <ms>` (Rust vs JS at equal time per move).

## License
GPL-3.0-or-later (see `LICENSE`); third-party components are listed in `NOTICE`.

## Future work

See [FUTURE_WORK.md](FUTURE_WORK.md) for reported mobile game-review and Cylinder-game defects, planned improvements, and regression checks.
