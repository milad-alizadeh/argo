import Foundation

/// The three acts a handoff is made of, as a port. Two touch a real PTY and a real CLI, and the
/// ORDER they happen in — type, wait, spawn — is what the port exists to make provable.
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
    /// Remember that one Session's work now belongs to another — the fourth act, and the only one
    /// after the handoff has succeeded. Told to the host rather than returned to the caller, so the
    /// sequence that PRODUCED the edge is the sequence that records it.
    func handedOff(sessionID: String, to fresh: String)
    /// The handoff has begun (#1327) — the moment the plinth over this Session starts standing.
    /// Told to the host before any of the three acts above, so the fact is DIRECT for exactly as
    /// long as Argo is actually running one.
    func handoffStarted(sessionID: String)
    /// The handoff has ended, however it went — the moment the plinth stands down. `failure` is
    /// `nil` for one that landed, in Argo's own words for one that did not; a landed handoff drops
    /// no row of its own here, because `handedOff(sessionID:to:)` already told the reading where
    /// the work went.
    func handoffEnded(sessionID: String, tookMs: Int, failure: String?)
}

/// How long Argo waits for a brief, and how often it looks. The limit is generous because
/// `/handoff` is a whole turn of real work on the fullest Session there is.
public struct HandoffPatience: Sendable, Equatable {
    public let pollMs: Int
    public let limitMs: Int

    public init(pollMs: Int, limitMs: Int) {
        self.pollMs = pollMs
        self.limitMs = limitMs
    }

    public static let `default` = HandoffPatience(pollMs: 500, limitMs: 20 * 60 * 1000)
}

/// The clock and the pause, as a seam — so the timeout is a rule a test can reach in a millisecond.
/// One value rather than two more parameters, which keeps `SessionHandoff`'s initialiser inside the
/// house's parameter cap.
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
