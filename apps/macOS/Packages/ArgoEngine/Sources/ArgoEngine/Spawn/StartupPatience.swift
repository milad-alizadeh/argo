import Foundation

/// How long Argo waits for a spawned CLI's first byte before it stops claiming the Session is
/// `starting` (#1245).
///
/// `starting` is DIRECT and managed-only, and exactly two things used to end it: bytes on the PTY,
/// or the process exiting. A child that comes up and prints nothing satisfies neither, so the row
/// held that word for the life of the window. This is the third way out, and the only one that is
/// Argo's own to take.
///
/// Short, unlike `PermissionPatience`: nobody is being waited on here. The number is how long a CLI
/// may take to paint its first frame on a cold machine, past which silence is news rather than
/// startup.
public struct StartupPatience: Sendable {
    /// What Argo waits, in seconds — published so a caller can say the number rather than restate
    /// it.
    public let seconds: Int

    /// How that wait is SPENT. `init(seconds:)` ties the two together and the internal init below
    /// is the only place they can part, which is `PermissionPatience`'s rule for the same reason:
    /// a published number that does not match the wait behind it is a lie about the limit.
    ///
    /// It must return to cancellation — every way the wait ends but its own clock cancels that
    /// clock, and a substitute that cannot be cancelled leaves a `Task` against a retired spawn.
    let elapse: @Sendable () async -> Void

    public init(seconds: Int) {
        self.init(seconds: seconds, elapse: { try? await Task.sleep(for: .seconds(seconds)) })
    }

    init(seconds: Int, elapse: @escaping @Sendable () async -> Void) {
        self.seconds = seconds
        self.elapse = elapse
    }

    public static let `default` = StartupPatience(seconds: 20)

    /// The one place a test says "now" to the wait above.
    public static let immediate = StartupPatience(seconds: 0)
}
