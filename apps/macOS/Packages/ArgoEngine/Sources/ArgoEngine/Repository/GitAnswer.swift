import Foundation

/// Everything one `git` invocation said: both of its channels and the status it exited with.
///
/// stderr is a VALUE here rather than `/dev/null` because it is the actionable half of a git
/// failure (`cockpit-failure-states-spec.md` §5): `! [rejected] … hint: Updates were rejected
/// because the remote contains work that you do not have locally` is the instruction, and "Push
/// failed" is not. The reads collapse it to absence — that collapse is `gitCommand`, and it is
/// theirs alone. A git WRITE takes this shape instead, so the first one to land cannot discard
/// the only text worth reading.
struct GitAnswer: Equatable, Sendable {
    /// stdout, verbatim and untrimmed. `nil` where the read produced nothing at all — an empty
    /// answer, bytes that were not UTF-8, or a descriptor that had gone bad under the read.
    let output: String?
    /// stderr, verbatim and untrimmed. Empty where git printed nothing on it, which is the normal
    /// case for a command that worked.
    let errorOutput: String
    /// What git exited with, as git means it: zero is the answer, anything else is a refusal.
    let status: Int32

    var isSuccess: Bool {
        status == 0
    }
}
