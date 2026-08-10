import Foundation

/// What Argo itself remembers about a Session, keyed by the Session's stable chain id.
///
/// Everything else about a Session is observed: the transcript is the source of truth and Argo
/// only reads it. These are the facts no external signal carries — a Session cleared off the
/// roster by hand, and the name a user gives one (#502). Owned glue, which is the one thing
/// `CONTEXT.md` says Argo may store.
///
/// Held as a value with every transition returning a new set, so the store above it does nothing
/// but read one and write one — which is what keeps the rules below testable with no filesystem
/// in the way.
public struct SessionAnnotations: Equatable, Sendable {
    /// One Session's annotations.
    ///
    /// A struct rather than the bare `Bool` archiving needs today, because a set keyed to one
    /// fact has to be re-keyed for the second one — and the second one is already spoken for.
    public struct Annotation: Equatable, Sendable {
        public var isArchived: Bool
        /// The name the user gave this Session, and `nil` for one they never named — which is
        /// what makes the derived title reachable again: dropping the name IS the reset (#502,
        /// story 20), so there is no second flag saying whether the name is in force.
        public var explicitName: String?

        public init(isArchived: Bool = false, explicitName: String? = nil) {
            self.isArchived = isArchived
            self.explicitName = SessionAnnotations.name(from: explicitName)
        }

        /// An annotation that asserts nothing, which is what every Session has until somebody
        /// says otherwise. Never written: a record per observed Session would grow this file
        /// with the machine's whole history of transcripts and say nothing in any of them.
        public var isEmpty: Bool {
            self == Annotation()
        }

        /// A copy with one fact changed, by mutation rather than by rebuilding: a second field
        /// added to this type would be silently dropped by an initialiser call left behind here.
        func archived(_ isArchived: Bool) -> Annotation {
            var next = self
            next.isArchived = isArchived
            return next
        }

        /// The same copy-with-one-fact-changed for the name.
        func named(_ name: String?) -> Annotation {
            var next = self
            next.explicitName = SessionAnnotations.name(from: name)
            return next
        }
    }

    let bySessionID: [String: Annotation]

    public static let empty = SessionAnnotations(bySessionID: [:])

    init(bySessionID: [String: Annotation]) {
        self.bySessionID = bySessionID.filter { !$0.value.isEmpty }
    }

    /// What is remembered about a Session, and an empty annotation for one nothing was ever said
    /// about — never `nil`. Absence here is not a gap in what Argo knows; it IS the answer.
    public func annotation(for sessionID: String) -> Annotation {
        bySessionID[sessionID] ?? Annotation()
    }

    public func isArchived(_ sessionID: String) -> Bool {
        annotation(for: sessionID).isArchived
    }

    /// A name is what somebody typed, trimmed — and blank is not a name.
    ///
    /// Public because the dialog that raises a rename has to know whether what is in the field IS
    /// one before it offers to keep it. Two places deciding that is how a confirm button comes to
    /// disagree with the record it writes — and normalising here rather than at the dialog means a
    /// name arriving from a hand-edited file obeys the same rule as one that was typed.
    public static func name(from typed: String?) -> String? {
        guard let trimmed = typed?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmed.isEmpty
        else { return nil }
        return trimmed
    }

    /// The name the user gave a Session, and `nil` for one they never named. Which title that
    /// `nil` falls back to is not decided here: the fallback chain is a rendering decision and
    /// lives in the projections, where it can be asserted (#502 §Seams).
    public func explicitName(_ sessionID: String) -> String? {
        annotation(for: sessionID).explicitName
    }

    /// Archive a Session, or put one back. Keyed on the chain id and on nothing observed, which
    /// is why re-reading a transcript cannot disturb it: a record arriving for an archived
    /// Session is new activity, and new activity is not a decision (#502, story 16).
    func archiving(_ isArchived: Bool, sessionID: String) -> SessionAnnotations {
        setting(annotation(for: sessionID).archived(isArchived), for: sessionID)
    }

    /// Name a Session, or drop the name it was given — the reset is `nil` and not a second verb,
    /// because "no explicit name" is the state every Session starts in (#502, story 20).
    func naming(_ name: String?, sessionID: String) -> SessionAnnotations {
        setting(annotation(for: sessionID).named(name), for: sessionID)
    }

    /// The one write path, so an annotation that has fallen back to asserting nothing is dropped
    /// rather than left behind as a record of a decision that was undone.
    private func setting(_ annotation: Annotation, for sessionID: String) -> SessionAnnotations {
        var next = bySessionID
        next[sessionID] = annotation
        return SessionAnnotations(bySessionID: next)
    }
}
