import Foundation

/// Handing a full Session's work to a fresh one: type `/handoff`, wait for the brief, open a
/// Session seeded with it (#513, story 47).
///
/// Three acts in that order. **It fabricates nothing** — no brief means no fresh Session and a
/// failure said out loud; the roster never grows a row for work that was not handed over.
@MainActor
public final class SessionHandoff {
    /// Which Session is being handed off, and what the fresh one inherits (story 48).
    ///
    /// `cwd` is the Workspace: the fresh Session runs in the same folder, so it is on the same
    /// branch, and every fact derived from that branch — the Delivery, and the Work Item the
    /// Delivery serves — derives the same way for both. Nothing is copied across.
    public struct Request: Sendable, Equatable {
        public let sessionID: String
        public let cwd: String
        /// The issue the Session was serving, when it was serving one. Named in the fresh Session's
        /// opening prompt so the work continues against the same intent.
        public let issue: Int?

        public init(sessionID: String, cwd: String, issue: Int? = nil) {
            self.sessionID = sessionID
            self.cwd = cwd
            self.issue = issue
        }
    }

    /// What a completed handoff produced: the brief on disk, and the Session now carrying the work.
    public struct Outcome: Sendable, Equatable {
        public let briefPath: String
        public let sessionID: String
    }

    /// Why a handoff did not happen, in words fit to repeat to the user — the same contract
    /// `AgentSpawnError` keeps (#361).
    public enum Failure: Error, Equatable {
        /// Argo owns no live PTY for that Session, so there is no prompt to type at.
        case notSteerable
        /// There is no folder to start the fresh Session in. The header disables its button on
        /// this same case and reads its tooltip sentence from HERE, so the two cannot disagree.
        case noFolder
        /// `/handoff` was typed and no brief appeared before Argo stopped waiting.
        case briefNeverArrived(afterMs: Int)

        public var detail: String {
            switch self {
            case .notSteerable:
                "Argo does not own this Session's terminal, so it cannot run /handoff in it"
            case .noFolder:
                "Argo has not read this Session's folder, so it cannot start one beside it"
            case let .briefNeverArrived(afterMs):
                "/handoff wrote no brief in \(afterMs / 60000) minutes"
            }
        }
    }

    private let host: HandoffHost
    private let root: URL
    private let wait: HandoffWait

    /// `root` is where briefs land — Argo's own per-machine data, never the Project.
    public init(host: HandoffHost, root: URL, wait: HandoffWait = .live) {
        self.host = host
        self.root = root
        self.wait = wait
    }

    public func run(_ request: Request) async throws -> Outcome {
        let brief = HandoffScript.briefURL(
            in: root,
            sessionID: request.sessionID,
            atMs: wait.now(),
        )
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        guard host.steer(
            sessionID: request.sessionID,
            typing: HandoffScript.command(writingBriefTo: brief.path),
        ) else { throw Failure.notSteerable }

        try await awaitBrief(at: brief.path)
        let sessionID = try await host.spawn(SessionSeed(
            cwd: request.cwd,
            opening: HandoffScript.opening(fromBriefAt: brief.path, issue: request.issue),
        ))
        // Last, and only where a fresh Session actually exists: an edge recorded before the spawn
        // returned would name a Session a refusal has just prevented from being there.
        host.handedOff(sessionID: request.sessionID, to: sessionID)
        return Outcome(briefPath: brief.path, sessionID: sessionID)
    }

    /// Poll until the brief is there, or until Argo has waited longer than it said it would.
    private func awaitBrief(at path: String) async throws {
        let deadline = wait.now() + wait.patience.limitMs
        while !hasArrived(at: path) {
            guard wait.now() < deadline else {
                throw Failure.briefNeverArrived(afterMs: wait.patience.limitMs)
            }
            try await wait.pause(wait.patience.pollMs)
        }
    }

    /// A file with nothing in it is `/handoff` having started and not finished — the command
    /// creating its output before it has anything to put there. Ending the wait on that seeds the
    /// fresh Session with an empty document, which is the one failure that would look like success.
    private func hasArrived(at path: String) -> Bool {
        guard let brief = host.brief(at: path) else { return false }
        return !brief.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}
