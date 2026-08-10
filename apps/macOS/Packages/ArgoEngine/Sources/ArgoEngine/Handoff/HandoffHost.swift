import Foundation

/// The three acts a handoff is made of, as a port.
///
/// A port rather than three calls into the Hub, for the reason every other engine seam is one: two
/// of these touch a real PTY and a real CLI, and the ORDER they happen in — type, wait, spawn — is
/// the whole of what this ticket decides. An orchestration provable only by starting `claude` is an
/// orchestration nothing holds to.
@MainActor
public protocol HandoffHost: AnyObject {
    /// Type at a Session's own prompt. `false` where Argo owns no live PTY for it, which is the one
    /// refusal the caller must not treat as "nothing happened".
    func steer(sessionID: String, typing text: String) -> Bool
    /// The brief, once it is there and has something in it. `nil` while it has not arrived — an
    /// empty file is a command that started and did not finish, and reads the same as absence.
    func brief(at path: String) -> String?
    /// Start a fresh Session, seeded. Returns the id of the row it published.
    func spawn(_ seed: SessionSeed) async throws -> String
}

/// How long Argo waits for a brief, and how often it looks.
///
/// The limit is generous on purpose. `/handoff` is a whole turn of real work — an agent reading its
/// own history back and writing a summary of it — and a Session full enough to need handing off is
/// the slowest one there is. Giving up early reports a failure that was only impatience.
public struct HandoffPatience: Sendable, Equatable {
    public let pollMs: Int
    public let limitMs: Int

    public init(pollMs: Int, limitMs: Int) {
        self.pollMs = pollMs
        self.limitMs = limitMs
    }

    public static let `default` = HandoffPatience(pollMs: 500, limitMs: 20 * 60 * 1000)
}

/// The clock and the pause, as a seam — so the timeout is a rule a test can reach in a millisecond
/// rather than one nothing ever exercises.
///
/// Its own value rather than two more initialiser parameters, which is also what keeps
/// `SessionHandoff`'s initialiser inside the house's parameter cap.
@MainActor
public struct HandoffWait {
    public let patience: HandoffPatience
    public let now: () -> Int
    public let pause: (Int) async throws -> Void

    public init(
        patience: HandoffPatience = .default,
        now: @escaping () -> Int = { Date().epochMs },
        pause: @escaping (Int) async throws -> Void = { milliseconds in
            try await Task.sleep(for: .milliseconds(milliseconds))
        },
    ) {
        self.patience = patience
        self.now = now
        self.pause = pause
    }

    public static let live = HandoffWait()
}
