/// What a fixture states about the Subagents' files: which are GROWING as the state is drawn, and
/// which Argo watched and has not seen grow since the growth window lapsed.
///
/// One value and not two sets passed side by side, because they are one reading — the same reading
/// `SubagentWriting` answers at runtime — and because a fixture that stated one and left the other
/// silently empty would be claiming something it did not mean.
///
/// A child in NEITHER set is one Argo never watched grow. That is a third claim again
/// (`SubagentWriting.unwatched`), and the one a chip's ending may not be read against: a file Argo
/// never saw grow dates nothing, so reading it as silence would quiet a live child on the first
/// frame after its backfill (#1392).
package struct StatedGrowth {
    let writing: Set<String>
    let silent: Set<String>

    package init(writing: Set<String> = [], silent: Set<String> = []) {
        self.writing = writing
        self.silent = silent
    }
}
