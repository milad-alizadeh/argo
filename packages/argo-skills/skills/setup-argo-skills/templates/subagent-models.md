## Choosing a subagent's model

**A subagent's model is a decision per dispatch**, never inherited from the session that spawns
it. A fan-out pays that decision once per agent, so it is where the wrong default costs most.

Read what the job actually asks for:

- **Gathering** — search the tree, list what exists, read files and report what they say, chase a
  reference to its target. The answer is already written down and the work is recall. **Take the
  cheapest model that can hold the task.** A frontier model reads the same files and returns the
  same list, slower and dearer.
- **Judging** — review a diff, weigh two designs, trace a bug through code that lies about
  itself, write prose someone will act on. The answer is nowhere on disk and the work is
  inference. **Take the strongest model available.** A cheap model here fails quietly: it returns
  a confident, shallower answer, and nothing in the output says so.

A job that is both splits into two: one gathering pass on the cheap model, handing its findings
to one judging pass on the strong one.

**Name the model and the reason in the line that reports the dispatch**, so a wrong call shows up
in the transcript rather than only in the bill.
