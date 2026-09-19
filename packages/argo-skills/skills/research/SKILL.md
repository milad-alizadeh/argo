---
name: research
description: Investigate a question with primary sources, save auditable evidence where the task permits, and answer only after the evidence is verified.
---

# Research

Research a question against the sources that own the facts. Save the evidence in one Markdown note so another person can audit the answer.

## Define the question

Write the research question and the decisions it must support. List any requested scope, date, product, repository, or comparison. State what would count as a complete answer.

Create a completion checklist before investigation. Include each question, comparison, required source class, required investigator, counterevidence pass, and evidence note. The answer is not complete until every item is done or marked unknown with its evidence.

Record the authorized write scope. Save the Markdown note in the repository only when the user requested repository evidence or implementation work. For a read-only review, save the note in the operating system temporary directory and report its absolute path.

Use primary sources first. Primary sources include official documentation, source code, specifications, first-party APIs, issue bodies, and maintainer comments. Label user reports as reports. Do not present them as confirmed causes or fixes.

## Investigate

Decide the required investigations before dispatch. When the harness supports agent dispatch, dispatch a background investigator. When it does not, run a separate local pass for the same contract. Give each required investigation an identifier and the exact question.

Use this return contract:

- Record each source URL or repository path.
- Connect each claim to its source.
- Separate confirmed facts, user reports, inferences, and unknowns.
- Record source dates and status when they affect the answer.
- Look for counterevidence and failed workarounds.
- Write the findings to the authorized Markdown note.

Keep the dispatch prompt visible in the parent task. While the investigator works, run an independent source pass on the claims that will decide the answer. Do not remove a required investigation after work starts only because it is slow, inconclusive, or inconvenient.

## Join and verify

Wait for each required investigator to finish. If an investigator fails, rerun it or mark its checklist item unknown with the failure evidence. Read the complete note before you draft the answer.

Open the decisive primary sources yourself. Make sure that each important claim says what the source supports. Tie local claims to paths and lines when possible. Remove claims that rely only on a search snippet or an investigator summary.

When sources disagree, report the disagreement. When no source confirms a cause or fix, say so.

## Completion barrier

Answer only when:

- The completion checklist covers the original question and has no open item.
- The note exists and was read.
- The original question is fully covered or each gap is marked unknown.
- Every decisive claim has a primary source.
- User reports and proposals are labeled.
- Required investigators have finished.
- The note location matches the authorized write scope.

If any condition fails, continue the research. Do not turn partial progress into a final answer.

Tell the user where the note was saved. Lead with the answer, then give the evidence and its limits.
