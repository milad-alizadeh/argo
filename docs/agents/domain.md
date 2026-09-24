# Domain docs

Argo uses one root domain index, `CONTEXT.md`, with sections in `docs/domain/` and decisions in `docs/adr/`.
The workspace packages share this index.

Before exploring a domain, read `CONTEXT.md` and open the section relevant to the work.
Follow `AGENTS.md` → *Where things are written down* for vocabulary, missing concepts, and conflicts with recorded decisions.
Before changing a term, read `docs/domain/rationale.md`.
Use the model's words in code. Cite it in comments as `CONTEXT.md L1 · Connection`.
A concept the model does not name is either an invented name to reconsider or a gap to record.
