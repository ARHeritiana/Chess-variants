# Offline commentary model evaluation — 2026-11-11

Decision: **discard both tested models**. Neither consistently offered a short, helpful
improvement over the engine-derived comments. No model, inference runtime, model download,
or model settings are included in the app.

## Method

Twelve controlled engine-fact fixtures per model; 24 real local WASM generations. The fixtures
cover development, a queen blunder and alternative, capturing a queen, castling, knight
underpromotion with check, checkmate, a missed forced mate, an equal exchange, en passant,
answering check, Cylinder chess, and a small inaccuracy. These test the explanation layer;
they do not measure chess-playing strength. No generated output was cherry-picked or edited.

Both models used wllama 2.3.7 / llama.cpp, a single CPU worker, 768 context tokens, batch size
64, greedy sampling (`temp: 0`, `seed: 1`) and at most 80 output tokens. Tests ran in desktop
Chromium 156.0.8078.79 on the cloud executor, **not on an Android phone**. Timings include
prompt processing and generation but exclude download/model loading; they are not phone
performance estimates. The model was supplied the verdict, played move, relevant facts and
an alternative where applicable.

Exact system instruction:

> Explain these chess review facts in one or two short sentences for a beginner. Only use
> these facts. Do not invent tactics, threats or other moves. Do not repeat the instructions.

Acceptance required factual consistency, no repetition, one or two short sentences, retention
of the useful finding/alternative, and a useful improvement over a concise deterministic comment.
A few good responses cannot compensate for misleading or frequently unhelpful ones. Keyword
checks in the transcript only flag missing terms and known bad phrases; the decision also used
manual reading of every output, including repetition, unsupported claims and factual distortion.

## Candidates and results

| Candidate | File / revision | Download | Mean generation | Decision |
|---|---|---:|---:|---|
| SmolLM2-135M-Instruct | Q4_K_M, `09816acd5d99df7be770d85ea30822623dab342c` | 105 MB | 11.2 s | Reject |
| SmolLM2-360M-Instruct | Q3_K_M, `7be6f65f1db715fe5dc5a4634c0d459b4eed42ec` | 235 MB | 27.9 s | Reject |

Model repositories: [135M](https://huggingface.co/bartowski/SmolLM2-135M-Instruct-GGUF)
and [360M](https://huggingface.co/bartowski/SmolLM2-360M-Instruct-GGUF). Downloads were tested
in temporary storage and are not redistributed here.

## Findings from the full fixture set

- **135M:** repeated bullet lists and unfinished responses for blunders/castling; described
  the engine's alternative as the played move in the exchange case; contradicted the supplied
  “best” verdict when answering check; omitted the suggested alternative for an inaccuracy;
  added a better chance of winning to a fixture described as balanced.
- **360M:** generally preserved more facts, but frequently returned three to six sentences,
  duplicated the played-move description, or offered circular explanations (“good because …
  a good move”). It also changed a loss of 45 percentage points into “45% of winning chances”.
  Several responses were adequate (for example checkmate and en passant), but the feature
  did not consistently improve the comments enough to justify a 234 MB download and slow
  generation.
- Both models could behave better or worse with a different prompt or quantization. This
  small controlled test is enough to reject these implementations, not to claim that all
  offline models are unsuitable. A future candidate should beat the existing comments on
  held-out real game positions and be measured on representative Android hardware before shipping.

## Retained implementation

Comments are generated directly from legal board transitions and the selected engine's
analysis: special moves, captures, checks/checkmate/stalemate, development, loss of winning
chances, missed forced mates and better alternatives. They work offline without a download,
keep the displayed engine verdict, and appear both in the walkthrough and tappable move list.

See [the full inputs, unedited outputs and timings](coach-model-results.json).
