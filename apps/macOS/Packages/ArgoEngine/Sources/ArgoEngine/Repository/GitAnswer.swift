import Foundation

/// Everything one `git` invocation said: both of its channels and the status it exited with.
///
/// stderr is a VALUE here rather than `/dev/null` because it is the actionable half of a git
/// failure (`cockpit-failure-states-spec.md` §5): "Push failed" is a paraphrase of the hint that
/// says to pull. `gitCommand` collapses it to absence for the reads, which have no failure surface
/// to put it on; a git WRITE takes this shape instead.
struct GitAnswer: Equatable, Sendable {
    /// stdout, verbatim and untrimmed. `nil` where the read produced nothing at all — an empty
    /// answer, bytes that were not UTF-8, or a descriptor that had gone bad under the read.
    let output: String?
    /// stderr, verbatim and untrimmed. Empty where git printed nothing on it, and where what it
    /// printed was not UTF-8.
    let errorOutput: String
    /// What git exited with, as git means it: zero is the answer, anything else is a refusal.
    let status: Int32

    var isSuccess: Bool {
        status == 0
    }
}
