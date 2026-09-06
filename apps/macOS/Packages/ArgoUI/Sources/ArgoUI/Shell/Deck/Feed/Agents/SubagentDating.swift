/// What the Subagents' OWN files say about WHETHER THEY ARE STILL WORKING, asked by Subagent ID.
///
/// The two clocked facts of `FeedAgents.told(_:by:ended:at:)`, apart from the third: what a run
/// took and cost is a figure, and a figure decides no dot. Split out because two surfaces now ask
/// for the dating and only one of them draws a meter — the rail draws both, the roster's leading
/// column draws dots alone (#1513) — and a reader that had to hand over a measure it never reads
/// would be handing over a closure written to be ignored.
///
/// - `writing`: whether Argo has watched that file GROW recently (`SubagentWriting`, #1269).
/// - `ending`: whether its last words were the report it stopped to file (`SubagentEnding`, #1392).
struct SubagentDating {
    let writing: (String) -> SubagentWriting
    let ending: (String) -> SubagentEnding
}
