/// What the Subagents' OWN files say about them, asked by Subagent ID.
///
/// The evidence the parent's record does not hold, in one value. Both halves answer the same
/// question from the same place — the child's transcript, which Argo holds anyway (#858) — and both
/// are read on the DATED pass rather than inside the memo, because the room's stamp does not move
/// for a child's bytes. One value rather than two parameters so `FeedAgents.told(_:by:at:)` keeps
/// its arity, and so a caller cannot hand over one half and quietly leave the other answering
/// "nothing".
///
/// - `writing`: whether Argo has watched that file GROW recently (`SubagentWriting`, #1269).
/// - `measure`: what the file itself says the run took and cost (`SubagentMeasure`, #1279).
struct SubagentEvidence {
    let writing: (String) -> SubagentWriting
    let measure: (String) -> SubagentMeasure
}
