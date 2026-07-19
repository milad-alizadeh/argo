## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- The graph stays current automatically: the **pre-commit hook** runs `graphify update .` (which also names communities deterministically) and stages `graphify-out/` into the commit. So the committed graph is always fresh and named — nothing to do by hand.
- For *thematic* community names, do it occasionally in-session (read `graphify-out/.graphify_analysis.json`, write `.graphify_labels.json`). Never run `graphify label` for upkeep — it re-clusters and drops dated backup snapshots on every call (churn).
