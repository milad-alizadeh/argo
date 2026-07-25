/**
 * Marker-bearing corpus for #203.
 *
 * #193's three samples were incidental — one happened to carry a negation, which is how the
 * `did NOT touch STT` failure surfaced at all. That cannot measure a rate. These chunks are
 * built to *carry* protected markers in the always-faithful core, so a drop is detectable
 * rather than lucky.
 *
 * Only the three voiced types appear (#192 rule 1): Status is usually not voiced and Raw
 * artifact is never voiced, so neither has a faithful core for the guard to bind to.
 *
 * `faithfulCore` is the annotation that makes this ground truth: the span #192's type table
 * declares non-droppable. The extractor derives expected markers from it (#199 §3) — authored
 * by hand precisely so the instrument is not marking its own homework.
 */

export type ChunkType = 'prompt-for-user' | 'recommendation' | 'result'

export type Chunk = {
  readonly id: string
  readonly type: ChunkType
  /** The dense agent output as it would appear in a tailed transcript. */
  readonly source: string
  /** The span that must survive per #192's always-faithful column. */
  readonly faithfulCore: string
}

export const CORPUS: readonly Chunk[] = [
  // ---------------------------------------------------------------- result / finding
  {
    id: 'r01',
    type: 'result',
    source:
      'Ran the full suite against the new connector. 412 tests pass, 3 fail — all three are in `uploadData.spec.ts` and all three are the unique-violation fallback path. I did not touch the STT adapter in this change, so those failures predate it; `git stash` + rerun confirms they fail on main too.',
    faithfulCore:
      '412 tests pass, 3 fail, all three in uploadData.spec.ts. I did not touch the STT adapter, so those failures predate this change.',
  },
  {
    id: 'r02',
    type: 'result',
    source:
      "Profiled the tail. The 900ms spike is not the query — Postgres returns in 11ms. It's the JSON serialisation of `order_item` rows in the connector, which only happens when the payload exceeds 64KB. Below that threshold the path is 40ms.",
    faithfulCore:
      'The 900ms spike is not the query; Postgres returns in 11ms. It is JSON serialisation, and only when the payload exceeds 64KB.',
  },
  {
    id: 'r03',
    type: 'result',
    source:
      'Migration applied cleanly. Note that `db:reset` dropped the `powersync` publication again, so replication is currently dead — no change will reach any client until `replication.sh` is re-run. REST writes still succeed, which is why it looks fine from the app.',
    faithfulCore:
      'Migration applied cleanly, but db:reset dropped the powersync publication, so no change will reach any client until replication.sh is re-run.',
  },
  {
    id: 'r04',
    type: 'result',
    source:
      'The lint gate is green but that might be misleading: `boundaries` only runs inside `apps/desktop`, and the new module lives in `packages/observe`, which has no module-boundaries.json yet. So nothing checked it.',
    faithfulCore:
      'The lint gate is green but that might be misleading: boundaries only runs inside apps/desktop, and packages/observe has no module-boundaries.json, so nothing checked it.',
  },
  {
    id: 'r05',
    type: 'result',
    source:
      'Reproduced on the second try. It seems to depend on ordering — if the ETA ticker fires before the status transition commits, the compare-and-swap silently no-ops and the order sticks in `preparing`. I could not reproduce it with the ticker stopped.',
    faithfulCore:
      'It seems to depend on ordering: if the ETA ticker fires before the status transition commits, the compare-and-swap no-ops. I could not reproduce it with the ticker stopped.',
  },
  {
    id: 'r06',
    type: 'result',
    source:
      'Benchmarked all four quantisations. Q4_K_M is the only one that fits in the 8GB budget; Q5 and above spill to swap and the TTFT triples. None of them beat the MLX build on first token.',
    faithfulCore:
      'Q4_K_M is the only one that fits the 8GB budget. None of them beat the MLX build on first token.',
  },
  {
    id: 'r07',
    type: 'result',
    source:
      'Typecheck passes. `bun run test` fails, but not because of your change — the `stories` job is flaking on a Chromium download timeout, and it has failed on the last six main builds too. Probably infrastructure rather than code.',
    faithfulCore:
      'Typecheck passes. Tests fail, but not because of your change: the stories job is flaking on a Chromium download timeout. Probably infrastructure, not code.',
  },
  {
    id: 'r08',
    type: 'result',
    source:
      'Searched the whole monorepo. There is no caller of `resetLocalDatabase` outside the dev menu, and nothing in `apps/desktop` imports it at all. Safe to change the signature — unless something reaches it dynamically, which I cannot rule out from static analysis.',
    faithfulCore:
      'There is no caller of resetLocalDatabase outside the dev menu. Safe to change the signature, unless something reaches it dynamically, which I cannot rule out.',
  },
  {
    id: 'r09',
    type: 'result',
    source:
      'Deploy went out. Health checks are green on all three regions, but the migration has not run in eu-west — the job is queued behind a long-running vacuum and will not start until that finishes. Reads are fine; writes to the new column will fail there.',
    faithfulCore:
      'Health checks are green on all three regions, but the migration has not run in eu-west and will not start until a vacuum finishes. Writes to the new column will fail there.',
  },
  {
    id: 'r10',
    type: 'result',
    source:
      'I checked the sync rules. `cart_item` appears nowhere in `sync_rules.yaml`, which is correct — it is local-only, so it should never sync. The bug is not a missing rule; it is that `AppSchema.ts` lost its `localOnly: true` option in the refactor, so writes are entering the CRUD queue.',
    faithfulCore:
      'cart_item appears nowhere in sync_rules.yaml, which is correct because it is local-only. The bug is not a missing rule: AppSchema.ts lost its localOnly true option.',
  },
  {
    id: 'r11',
    type: 'result',
    source:
      'Audited the 31 stories. 29 render clean. `SessionCard/Overflowing` throws, and `TerminalPane/GPUFallback` renders but logs a React key warning. Neither is caught by the CI gate today because the gate only fails on throws, not on console noise.',
    faithfulCore:
      '29 of 31 stories render clean. SessionCard/Overflowing throws; TerminalPane/GPUFallback logs a key warning. The gate only fails on throws, not console noise.',
  },
  {
    id: 'r12',
    type: 'result',
    source:
      'The leak is real but small: about 40KB per session open/close cycle, and it never gets collected because the transcript tailer holds a closure over the whole session object. You would need roughly 200 cycles before it is noticeable.',
    faithfulCore:
      'The leak is real: about 40KB per session cycle, and it never gets collected because the tailer holds a closure over the session object.',
  },
  {
    id: 'r13',
    type: 'result',
    source:
      'Both paths work. The difference is that the worktree path does not copy `.env.local`, so a nested agent gets no Supabase credentials unless you pass them explicitly. That is likely why the nested run failed and the top-level one did not.',
    faithfulCore:
      'The worktree path does not copy .env.local, so a nested agent gets no Supabase credentials unless you pass them explicitly.',
  },
  {
    id: 'r14',
    type: 'result',
    source:
      'Verified against the spec. Every field matches except `rejection_reason`, which the spec says is required whenever status is `rejected` — the implementation allows it to be null. No test covers that case.',
    faithfulCore:
      'Every field matches except rejection_reason, which the spec requires whenever status is rejected; the implementation allows null. No test covers that case.',
  },

  // ---------------------------------------------------- recommendation / proposal
  {
    id: 'c01',
    type: 'recommendation',
    source:
      'Three ways to fix this. One: pin the status in the WHERE clause so a double tap cannot skip a stage — small, local, and it is what the other transitions already do. Two: add an optimistic-concurrency version column, which is more correct but touches the Postgres schema and both Drizzle mirrors. Three: serialise transitions through a queue, which I would not do — it adds a moving part for a problem that only appears on double tap. I recommend option one.',
    faithfulCore:
      'I recommend option one: pin the status in the WHERE clause so a double tap cannot skip a stage. Three options existed.',
  },
  {
    id: 'c02',
    type: 'recommendation',
    source:
      'I would use the extractive fallback rather than a second model call. A retry might work, but it shares the failure mode we are trying to catch, and it roughly doubles the latency on the violation path. Extractive is clunky but it cannot invert meaning. The alternative is punting to screen, which abandons the eyes-free channel exactly when it matters.',
    faithfulCore:
      'I recommend the extractive fallback, not a second model call. A retry might work but shares the failure mode. Three options existed.',
  },
  {
    id: 'c03',
    type: 'recommendation',
    source:
      'Two candidates. Kokoro gives you a neural voice good enough to judge prosody, but needs espeak-ng from brew and a Python sidecar. The macOS `say` binary needs nothing at all, but it is too robotic to evaluate anything by ear. Go with Kokoro — you cannot make a voice-quality call on `say`.',
    faithfulCore:
      'Recommend Kokoro over macOS say: you cannot make a voice-quality call on say, it is too robotic. Two options existed.',
  },
  {
    id: 'c04',
    type: 'recommendation',
    source:
      'Do not add the shared types package. Metro is not configured for monorepo resolution, so it will not resolve across workspaces without a custom resolver, and that is a lot of config to maintain for four row types. Keep deriving frontend types from AppSchema and backend types from the pgTables, as now.',
    faithfulCore:
      'Do not add the shared types package: Metro is not configured for monorepo resolution and will not resolve across workspaces. Keep deriving types as now.',
  },
  {
    id: 'c05',
    type: 'recommendation',
    source:
      'My recommendation is to gate this behind a flag rather than shipping it on. The reshaper is only faithful at temperature zero in our testing, and we have not measured what happens under load. If it turns out to be robust you can flip the flag without another release.',
    faithfulCore:
      'Recommend gating behind a flag rather than shipping on: the reshaper is only faithful at temperature zero and we have not measured it under load. Two options existed.',
  },
  {
    id: 'c06',
    type: 'recommendation',
    source:
      'Between the two: the 4B is probably fast enough and leaves headroom for the audio model on a 16GB machine. The 9B is more faithful but you cannot run both locally under 24GB. I would take the 4B unless the drop rate turns out to be materially worse.',
    faithfulCore:
      'Recommend the 4B: probably fast enough and leaves headroom on 16GB. You cannot run both locally under 24GB. Take the 4B unless its drop rate is materially worse. Two options existed.',
  },
  {
    id: 'c07',
    type: 'recommendation',
    source:
      'I would not raise the concurrency cap. The bottleneck is not the number of agents, it is that each one re-reads the whole graph on startup; raising the cap just multiplies that read. Cache the graph in the parent and pass it down instead.',
    faithfulCore:
      'Do not raise the concurrency cap: the bottleneck is not agent count but each one re-reading the whole graph. Cache it in the parent instead. Two options existed.',
  },
  {
    id: 'c08',
    type: 'recommendation',
    source:
      "Four options on the table, and honestly none of them is clean. The least bad is to keep the publication creation in `replication.sh` and call it from both `up.sh` and `db:reset` — which is what it does now. The others all involve teaching Supabase's reset about a publication it does not own.",
    faithfulCore:
      'Recommend keeping publication creation in replication.sh, called from both up.sh and db:reset. Four options existed and none is clean.',
  },
  {
    id: 'c09',
    type: 'recommendation',
    source:
      'Use the latching toggle, not a held key. Push-to-talk means you cannot barge in with your hands on the keyboard, and every long dictation becomes a physical chore. The visible on-state solves the discoverability problem a latch normally has.',
    faithfulCore:
      'Recommend the latching toggle, not a held key: with push-to-talk you cannot barge in with hands on the keyboard. Two options existed.',
  },
  {
    id: 'c10',
    type: 'recommendation',
    source:
      "I suggest we do not decide transport now. The numbers only separate the options once you know the target machine's RAM, and we do not know that until the app ships. All three remain viable; deferring costs nothing because the harness is identical for each.",
    faithfulCore:
      'Recommend not deciding transport now: the options only separate once you know target RAM, which we do not know yet. All three remain viable. Three options existed.',
  },
  {
    id: 'c11',
    type: 'recommendation',
    source:
      'Take the second approach. The first is faster to write but it only handles the single-session case, and you will rewrite it the moment addressing lands. The second costs a day more now and does not need revisiting.',
    faithfulCore:
      'Recommend the second approach: the first only handles the single-session case and will be rewritten when addressing lands. Two options existed.',
  },
  {
    id: 'c12',
    type: 'recommendation',
    source:
      'Given the constraint, prune hedging from the protected class. It is the only one of the four whose loss does not invert a claim — you might argue it weakens one, but nobody is misled about what is true. Keep negation, restrictors and conditionality.',
    faithfulCore:
      'Recommend pruning hedging from the protected class: it is the only one whose loss does not invert a claim. Keep negation, restrictors and conditionality.',
  },
  {
    id: 'c13',
    type: 'recommendation',
    source:
      'Do it in two commits, not one. The rename touches 40 files and the behaviour change touches 3; if they land together nobody can review the 3 that matter. Land the mechanical rename first, then the behaviour on top.',
    faithfulCore:
      'Recommend two commits, not one: if they land together nobody can review the 3 that matter. Two options existed.',
  },
  {
    id: 'c14',
    type: 'recommendation',
    source:
      'My pick is the MLX build. It is roughly as fast as llama.cpp here and the memory ceiling is lower, but it only runs on Apple silicon — so if you ever want a Linux target you cannot ship it as the only backend. Keep the GGUF path behind it.',
    faithfulCore:
      'Recommend the MLX build: as fast as llama.cpp with a lower memory ceiling, but it only runs on Apple silicon, so keep GGUF behind it. Two options existed.',
  },

  // ------------------------------------------------------------- prompt-for-user
  {
    id: 'p01',
    type: 'prompt-for-user',
    source:
      'Before I go further I need a call from you. The migration renames `eta_seconds`, and I cannot do that without a destructive step: the column has to be dropped and recreated, so any rows mid-flight lose their countdown. Do you want me to proceed, or add a nullable column and backfill instead?',
    faithfulCore:
      'I need a call from you. This cannot be done without a destructive step: the column must be dropped and recreated, so rows mid-flight lose their countdown. Proceed, or add a nullable column and backfill?',
  },
  {
    id: 'p02',
    type: 'prompt-for-user',
    source:
      'Quick check before I commit: the guard currently fails closed, so if the marker check throws, nothing is spoken at all. Is silence acceptable there, or should it fall through to the extractive path even when the checker itself is broken?',
    faithfulCore:
      'The guard currently fails closed, so if the check throws, nothing is spoken. Is silence acceptable, or should it fall through to the extractive path?',
  },
  {
    id: 'p03',
    type: 'prompt-for-user',
    source:
      'I can force-push to clean up the history, but that cannot be undone for anyone who has already pulled this branch — and the CI run currently in flight would be orphaned. Want me to, or shall I add a fixup commit instead?',
    faithfulCore:
      'Force-push cannot be undone for anyone who has already pulled, and would orphan the in-flight CI run. Force-push, or add a fixup commit?',
  },
  {
    id: 'p04',
    type: 'prompt-for-user',
    source:
      'Two of the four axes disagree about whether this is a bug. Standards says the compare-and-swap is fine; Spec says the issue asked for a hard failure, not a silent no-op. I do not think I should pick — which reading do you want me to build to?',
    faithfulCore:
      'Two axes disagree: Standards says the compare-and-swap is fine, Spec says the issue asked for a hard failure, not a silent no-op. Which reading should I build to?',
  },
  {
    id: 'p05',
    type: 'prompt-for-user',
    source:
      'The download will not finish inside this session — it is 4.5GB and the connection is doing about 3MB/s. I can either wait and block, or scaffold everything else and run the sweep when it lands. Which?',
    faithfulCore:
      'The download will not finish inside this session. Wait and block, or scaffold everything else and run the sweep when it lands? Two options existed.',
  },
  {
    id: 'p06',
    type: 'prompt-for-user',
    source:
      'Confirm before I run this: `db:reset` wipes the local database, and it will also drop the `powersync` publication, so you will need to re-run replication afterwards. There is no undo. Go ahead?',
    faithfulCore:
      'db:reset wipes the local database and drops the powersync publication. There is no undo. Go ahead?',
  },
  {
    id: 'p07',
    type: 'prompt-for-user',
    source:
      'I need to know how strict you want this. Should the checker treat a missing marker as a violation only when it appears in the faithful core, or anywhere in the source chunk? The second is safer but it will drag every `if` from the reasoning into the lead.',
    faithfulCore:
      'Should the checker treat a missing marker as a violation only when it appears in the faithful core, or anywhere in the source chunk? The second is safer but drags every if into the lead.',
  },
  {
    id: 'p08',
    type: 'prompt-for-user',
    source:
      'Approval needed. Publishing this creates a public URL that may be cached or indexed even if you delete it later, and the page includes the raw benchmark output. Publish, or keep it as a file?',
    faithfulCore:
      'Publishing creates a public URL that may be cached or indexed even if deleted later, and the page includes raw benchmark output. Publish, or keep as a file?',
  },
  {
    id: 'p09',
    type: 'prompt-for-user',
    source:
      'One thing I cannot decide for you: if the sweep shows the 4B dropping markers but only above a 25-word cap, do you want the cap raised, or the 9B? Raising the cap costs speaking time on every line; the 9B costs RAM you may not have.',
    faithfulCore:
      'If the 4B drops markers only above a 25-word cap, raise the cap or move to the 9B? Raising the cap costs speaking time on every line; the 9B costs RAM. Two options existed.',
  },
  {
    id: 'p10',
    type: 'prompt-for-user',
    source:
      'Before the sweep runs — should I include Qwen2.5-7B as an anchor? It is the model #193 measured, so it makes the numbers comparable, but it is two generations old and we would not ship it. It adds about twenty minutes.',
    faithfulCore:
      'Should I include Qwen2.5-7B as an anchor? It makes numbers comparable to #193, but it is two generations old and we would not ship it.',
  },
  {
    id: 'p11',
    type: 'prompt-for-user',
    source:
      'This needs your judgement, not mine. The spec says voice off means silent in both directions, but it does not say what happens to an answer already being spoken when you toggle off. Drop it, or let it land?',
    faithfulCore:
      'The spec does not say what happens to an answer already being spoken when you toggle off. Drop it, or let it land?',
  },
  {
    id: 'p12',
    type: 'prompt-for-user',
    source:
      'I am about to delete the stale worktrees. Three of them have unpushed commits, so removing those would lose work — I will skip those unless you tell me otherwise. Remove the other nine?',
    faithfulCore:
      'Three worktrees have unpushed commits, so removing those would lose work. I will skip those unless you say otherwise. Remove the other nine?',
  },
  {
    id: 'p13',
    type: 'prompt-for-user',
    source:
      'Clarification, because it changes the whole design: when you said the concierge should not interrupt, did you mean never, or only while a session is mid-turn? Those are very different specs and I do not want to guess.',
    faithfulCore:
      'When you said the concierge should not interrupt, did you mean never, or only while a session is mid-turn?',
  },
  {
    id: 'p14',
    type: 'prompt-for-user',
    source:
      'Permission to install: this pulls LM Studio and about 5GB of model weights onto your machine, and the download cannot be resumed if you cancel partway. Proceed?',
    faithfulCore:
      'This installs LM Studio and about 5GB of weights, and the download cannot be resumed if you cancel partway. Proceed?',
  },
]
