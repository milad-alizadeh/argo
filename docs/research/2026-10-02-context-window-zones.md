# Context-window zones

Sources read on 2026-10-02. Context is the information that an AI model reads for its next response.

Matt Pocock explains the Smart Zone and Dumb Zone in his
[Ralph plugin article](https://www.aihero.dev/why-the-anthropic-ralph-plugin-sucks), updated January 22, 2026.
The article uses the first 40% and last 60% of context as a guide. It says that the boundary is debated.

Pocock explicitly credits Dex Horthy of HumanLayer in his
[AI coding workshop at 3:12](https://www.youtube.com/watch?v=-QFHIoCo-Ko&t=192s).
The [organizer's transcript](https://ai.engineer/talks/-QFHIoCo-Ko) records the credit before the zone explanation at 3:21.
Pocock names Horthy as the person behind the idea. He does not identify a specific earlier article in that passage.

Horthy explains the Dumb Zone in
[No Vibes Allowed at 5:55](https://www.youtube.com/watch?v=rmvDxxNubIg&t=355s).
The [organizer's transcript](https://ai.engineer/talks/rmvDxxNubIg-context-engineering-for-complex-codebases)
records his warning at 6:22 that the 40% guide depends on task complexity.
His earlier [context engineering article](https://www.humanlayer.dev/blog/advanced-context-engineering), dated August 29, 2025,
explains how excess noise reduces the quality of the information that an agent uses.

The percentage is not a measured limit for every model. Pocock's
[later dictionary entry](https://www.aihero.dev/ai-coding-dictionary/smart-zone)
describes a gradual decline, gives a debated range of 125,000 to 150,000 tokens, and separates useful context from advertised capacity.
Argo's below-20% target is a product guide. These sources do not establish 20% as a universal boundary.

[Anthropic's context engineering guidance](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
explains the cause: more information competes for the model's limited attention.
Recall and reasoning can become less precise as context grows. The decline is gradual rather than an abrupt failure.
Keep only information that serves the task. Before a fresh session, save the decisions and next steps that it needs.

Concise UI attribution: "Matt Pocock explains these zones and credits Dex Horthy."
Link Pocock to his workshop and Horthy to his original talk. Describe Argo's percentage as a guide rather than a fixed limit.
