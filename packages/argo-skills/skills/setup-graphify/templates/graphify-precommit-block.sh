# --- graphify: committed knowledge graph, refreshed in-commit (installed by setup-graphify) ---
# Refresh + stage the graph INTO this commit, but ONLY in the main working tree. Linked
# worktrees are skipped (git-dir != git-common-dir), so feature branches never churn or
# conflict the graph — it stays a property of the integrated (main) codebase. `graphify update`
# (>=0.9.15) PRESERVES existing community names; NEW communities are named separately by the
# SessionStart hook. No post-commit hook anywhere. No-op until the graph exists.
if command -v graphify >/dev/null 2>&1 && [ -f graphify-out/graph.json ] \
   && [ "$(git rev-parse --git-dir 2>/dev/null)" = "$(git rev-parse --git-common-dir 2>/dev/null)" ]; then
  graphify update . >/dev/null 2>&1 || true
  git add graphify-out >/dev/null 2>&1 || true
fi
# --- end graphify ---
