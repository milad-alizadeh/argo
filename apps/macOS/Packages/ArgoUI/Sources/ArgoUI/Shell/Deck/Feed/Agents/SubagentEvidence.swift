/// What the Subagents' OWN files say about them, asked by Subagent ID.
///
/// The evidence the parent's record does not hold, in one value. All three answer the same
/// question from the same place — the child's transcript, which Argo holds anyway (#858) — and all
/// three are read on the DATED pass rather than inside the memo, because the room's stamp does not
/// move for a child's bytes. One value rather than three parameters so
/// `FeedAgents.told(_:by:ended:at:)` keeps its arity, and so a caller cannot hand over one part and
/// quietly leave the others answering "nothing".
///
/// The two clocked facts sit in `SubagentDating`, which is what a surface drawing dots and no
/// meter is handed on its own (#1513). The measure joins them here, for the one pass that draws
/// both.
///
/// - `dating`: whether the child is still working (`SubagentDating`).
/// - `measure`: what the file itself says the run took and cost (`SubagentMeasure`, #1279).
struct SubagentEvidence {
    let dating: SubagentDating
    let measure: (String) -> SubagentMeasure

    init(
        writing: @escaping (String) -> SubagentWriting,
        ending: @escaping (String) -> SubagentEnding,
        measure: @escaping (String) -> SubagentMeasure,
    ) {
        self.dating = SubagentDating(writing: writing, ending: ending)
        self.measure = measure
    }
}
