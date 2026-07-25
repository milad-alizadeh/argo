# #203 — marker-drop rate: setting the guard's dials

Throwaway measurement rig for [#203](https://github.com/milad-alizadeh/argo/issues/203).

**The inversion that makes this honest:** the instrument and the guard are the same code. You
cannot count marker-drops without the marker extractor [#199](https://github.com/milad-alizadeh/argo/issues/199)
mandates, so building it *is* how the data is obtained — not a bet placed ahead of it.

| file | what it is |
|---|---|
| `markers.ts` | **the guard.** #199's four-class lexicon, closed substitution table, exact-token check, named retry, extractive fallback |
| `corpus.ts` | 42 marker-bearing chunks across #192's three voiced types, each annotated with its always-faithful core |
| `contract.ts` | #192's contract as a reshaper prompt, with #199's three amendments; word cap injected as the sweep's independent variable |
| `models.ts` | LM Studio (local, thinking forced off) + subscription `claude` CLI (Haiku) |
| `sweep.ts` | the run: cap × model × temp, with #199's retry path measured |
| `report.ts` | aggregation into the five deliverables #203 asked for |
| `verify-instrument.ts` | **run this first.** 11 cases incl. #193's actual failure; a false positive here is worse than a miss |

```bash
bun verify-instrument.ts                                    # must pass before trusting numbers
bun sweep.ts --models qwen3.5-4b,gemma4-e4b,haiku --temps
bun report.ts results.json
```

Notes on the harness:

- **Thinking is forced off** on both local models. Not only #193's latency finding — arXiv
  2606.09662 finds built-in thinking *degrades* required-keyword, negation and conditional
  constraints, exactly the classes #199 protects. `report.ts` flags any trial where thinking
  leaked, because those rows measure a different model than intended.
- **Rate is per marker instance**, not per line — a line carrying three markers and dropping one
  is a partial failure, and averaging that to "one bad line" hides which class is weak. The
  line-level violation rate is reported alongside, since that is what actually gates speech.
- **Haiku has one temperature arm only**: the `claude` CLI exposes no temperature flag. A real
  gap in the temp dial, reported rather than papered over.
- The substitution table is seeded **minimal on purpose**. Near-misses are logged as `untabled`
  so the report proposes table rows from data; growing it by imagination defeats the measurement.
