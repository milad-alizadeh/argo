import Foundation

/// What `codex app-server` says its thread is doing, off `thread/status/changed` (#683, ADR-0024).
///
/// The four arms are the server's own `ThreadStatus` union and the two flags are its
/// `ThreadActiveFlag`, verified against `CodexClient.verifiedAgainst` and re-derivable with
/// `codex app-server generate-json-schema`.
///
/// A Codex Session writes no transcript Argo reads, so this notification is the only thing on this
/// surface that says whether a Turn is running. Without it the DERIVED fold sees no Turn boundary
/// at all, and a Session with no boundary reads as `running` for as long as its process lives.
enum CodexThreadStatus {
    /// There is no thread yet — the handshake has not got there.
    case notLoaded
    case idle
    case systemError
    /// A set, because the server's order carries nothing: two flags mean two things being waited
    /// on, and the reading below asks which are present rather than which came first.
    case active(Set<Flag>)

    /// Both flags are the thread blocked on a person: an approval it is holding open, or a question
    /// one of its tools asked.
    enum Flag: String {
        case waitingOnApproval
        case waitingOnUserInput
    }

    /// The notification's `status` object. Nothing where the arm is one this vocabulary cannot
    /// read, which leaves the caller the last status it could read rather than a guess.
    init?(_ status: JSONValue) {
        switch status.stringField("type") {
        case "notLoaded": self = .notLoaded
        case "idle": self = .idle
        case "systemError": self = .systemError
        // A flag this vocabulary does not know leaves the thread active on the flags that were
        // read: the arm is the server's word and only the flag list is coarser.
        case "active": self = .active(Self.flags(status))
        default: return nil
        }
    }

    /// The Session status this establishes, and nothing where it establishes none.
    var reading: SessionStatus? {
        switch self {
        case .notLoaded: nil
        case .idle: .idle
        // Not `stopped`: that word is a Turn that hit a wall of its own, and a thread the server
        // has failed is not one. Degrade-down puts it at `unknown` rather than a state of its own.
        case .systemError: .unknown
        case let .active(flags): Self.reading(flags)
        }
    }

    private static func flags(_ status: JSONValue) -> Set<Flag> {
        let read = status["activeFlags"]?.array ?? []
        return Set(read.compactMap { $0.string.flatMap(Flag.init(rawValue:)) })
    }

    /// An approval outranks a question, because it is the one a Turn cannot get past.
    ///
    /// `waitingOnApproval` reads as `permission` even though the gate's own prompt outranks it in
    /// `HubSession.statusReading`, so this arm is only ever reached with no prompt to answer — the
    /// moment before the request arrives, and after Argo has refused one itself. `running` would be
    /// the wrong word there: the thread has said it is blocked, and drawing it as working is the
    /// one reading that stops anybody going to look.
    private static func reading(_ flags: Set<Flag>) -> SessionStatus {
        if flags.contains(.waitingOnApproval) {
            return .permission
        }
        return flags.contains(.waitingOnUserInput) ? .asking : .running
    }
}
