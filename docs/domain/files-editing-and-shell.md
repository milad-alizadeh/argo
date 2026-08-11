## Files, editing & shell (Argo as a light agentic IDE)

Beyond *observing* agents, Argo directly views/edits files and runs commands — first-party
capabilities independent of any session.

- **File** — a path + content in a **Workspace**'s working tree (so file views are
  Workspace-scoped, not Project-scoped). DIRECT. A first-party edit mutates the working tree →
  surfaces as Workspace `dirty`/`unpushed` (no separate state).
- **File explorer / lightweight editor** — UI surfaces, not domain entities. Explicitly **not**
  a full IDE.
- **Open in editor** — an action on a File or the Project: Argo's built-in editor, or **hand off
  to an external editor**. A capability, not an entity.
- **Scratch terminal** — a plain **Terminal** (PTY) in a Workspace's cwd, attached to **no
  Agent/Session**. Same PTY machinery as a session terminal, minus the agent.
