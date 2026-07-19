# --- graphify: committed knowledge graph, kept fresh in-commit (installed by setup-graphify) ---
# Replaces graphify's stock async post-commit hook. `graphify update .` refreshes the graph
# (AST only, fast, deterministic) AND names communities from their dominant node — no LLM, no
# API key, no churn. Staging it puts the fresh, named graph INSIDE this commit. No-op until the
# graph exists. `git add graphify-out` respects .gitignore, so the heavy graph.html / cache/
# (ignored by setup-graphify) are never staged.
#
# Deliberately NOT running `graphify label` here: it re-clusters and drops a dated backup
# snapshot on every call (churn), and needs an API key/backend. Deterministic node-naming is
# what makes this plug-and-play. Want thematic LLM names? Do it occasionally in-session (the
# graphify skill's "Label communities" step) — never per-commit.
if command -v graphify >/dev/null 2>&1 && [ -f graphify-out/graph.json ]; then
  graphify update . >/dev/null 2>&1 || true
  git add graphify-out >/dev/null 2>&1 || true
fi
# --- end graphify ---
