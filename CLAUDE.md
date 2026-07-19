## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- **Name communities in this session, not in CI.** After a build or `graphify update .`, if any communities are still `Community N` placeholders, name just those here: read `graphify-out/.graphify_analysis.json`, choose a 2–5 word plain-language name per placeholder, save them to `.graphify_labels.json`, and regenerate the report (the graphify skill's "Label communities" step). Only name missing placeholders — never run `graphify label` for upkeep, which mass-relabels and can wipe curated names.
