# Future work

Pending improvements and reported defects. These are **not yet implemented or verified as fixed**.

## Mobile game review and gameplay — reported 2026-11-01

Source: owner feedback and two Android screenshots shared on 2026-11-01. These are observations to investigate, not independently reproduced defects. Test on a normal-size Android phone as well as smaller and larger viewports.

### P0 — Cylinder game responsiveness and stale review state

**Observed:** When starting or playing a **Cylinder** game against the built-in engine, several seconds can pass before the engine responds and/or the interface allows the player to move. Content from an earlier **Game review** remains visible, although the player has left that review.

**Investigate separately, then check for shared causes:**
- Measure the delay from a player move to the next legal interaction and from the engine's turn starting to its move; distinguish intended engine thinking time from UI blocking or an incorrectly retained "busy" state.
- Check worker startup, message handling and cancellation, pending searches, and turn/input-lock lifecycle when switching surfaces or starting a new game. Do not presume that the engine is the only cause.
- Ensure entering a new game clears/hides all review-only UI, data, graph overlays, analysis indicators, arrows, and listeners; background review activity must not overwrite the new game's display.
- Confirm the board remains responsive during engine thinking, with clear thinking feedback and correct turn ownership, including when switching from a finished/reviewed Classical game to Cylinder.

**Done when:** Review -> new Cylinder game does not show any previous review elements; the game correctly allows legal input on the human turn; delays are characterized and any unexpected blocking is eliminated; no stale review/engine callbacks can affect subsequent games.

### P1 — Review graph appears stretched, overly zoomed or deformed

**Observed:** The evaluation graph is abnormally zoomed/distorted when first entering Game review. One screenshot shows a greatly enlarged, oddly shaped graph.

**Investigate:** Inspect canvas backing-store dimensions vs CSS dimensions, device-pixel ratio, viewport scaling, chart bounds/normalization, and redraw timing after the review panel is shown or resized. Check initial render as well as subsequent moves, theme changes, and orientation changes.

**Done when:** The complete evaluation trace renders at a sensible scale and proportion immediately upon opening the review, without stretched or clipped regions; resizing and switching reviews preserve correct geometry.

### P1 — Horizontal overflow / unstable mobile viewport

**Observed:** The entire screen can shift left/right on an ordinary Android phone, as though the layout is wider than the viewport. A screenshot shows portions of the chessboard/header cut off horizontally.

**Investigate:** Find every element forcing document-level horizontal overflow (board, capture rows, move navigation, review chart, responsive controls, or fixed-width containers). Check CSS sizing, padding, min-width, overflow, orientation, and WebView viewport metadata. Do not merely hide overflow while leaving controls clipped.

**Done when:** All app views fit within the phone's available width, no sideways panning of the page is possible, no board/control is cut off, and layout remains stable through review/open/close transitions across common phone sizes and all themes.

### P1 — Explore alternative moves from Game review

**Requested feature:** From any reviewed position, allow the user to make a different legal move on the board and have the selected engine analyse the resulting variation.

**Expected behavior:**
- The board accepts legal trial moves from a selected historical position without overwriting the original recorded game.
- Display the variation and updated engine evaluation, recommended continuation, and relevant best-move comparisons; maintain clear differentiation between original moves and exploratory branches.
- Allow stepping through the variation, making more trial moves, and returning to the original game at the selected position.
- Respect each surface's rules: Stockfish/Maia where supported on Classical, built-in engine for Cylinder/Bounce; analysis must be cancellable when leaving review.
- Handle user interaction, graph update, and engine delays smoothly on mobile.

**Done when:** Users can explore and analyse variations, go back to the actual game, and close/reopen review with the original game's history unchanged.

### P2 — Improve move suggestion arrows

**Observed:** Move arrows look unattractive and their tails begin directly on top of chess pieces, obscuring the pieces.

**Requested:** Redesign arrows with clearer visual hierarchy, sensible stroke/arrowhead sizes, and tails anchored toward the edge of the origin square or offset from the piece rather than drawn over it. Ensure destination visibility; arrows must be readable across themes, board sizes, and orientations. Test unusual movements on Cylinder/Bounce too.

**Done when:** The start and end of a suggested move are visually obvious without covering the relevant piece artwork; arrows look consistent in all four themes and on phones.

### P2 — Restore ordinary vertical scrolling on the noninteractive review graph

**Observed:** Touching/swiping the graph prevents normal page scrolling, but the graph currently offers no useful touch interaction.

**Requested:** Do not intercept touch/pointer gestures or disable scrolling for a passive graph. If graph interaction is added later, design gestures deliberately so vertical scrolling remains natural (for example, a discrete tap to select a position rather than consuming every swipe).

**Done when:** Swiping vertically on the chart scrolls the page as it does on neighboring content, without accidental zoom or gesture capture.

## Regression checklist

- Start a Classical game, open review, close review, start a Cylinder game against the built-in engine, and play multiple turns.
- Open review from a saved or completed game, navigate moves, resize/orient the screen, and repeat with different themes.
- Swipe the review graph to scroll; inspect arrows and graph geometry.
- Try an alternate legal move in review, analyse multiple plies, and return to the unmodified original game.
- Check for sideways page movement, stale review elements, blocked input, and async engine callbacks after closing the review.

**Priority:** P0 gameplay/state correctness, P1 review functionality/layout, P2 visual/gesture polish. Priorities are proposed; the exact causes of the reported bugs remain to be diagnosed.
