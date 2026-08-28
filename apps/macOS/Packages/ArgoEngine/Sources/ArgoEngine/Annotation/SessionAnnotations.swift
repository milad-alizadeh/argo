import Foundation

/// What Argo itself remembers about a Session, keyed by the Session's stable chain id.
///
/// Everything else about a Session is observed: the transcript is the source of truth and Argo
/// only reads it. These are the facts no external signal carries — a Session cleared off the
/// roster by hand, and the name a user gives one (#502). Owned glue, which is the one thing
/// `CONTEXT.md` says Argo may store.
///
/// The ticket reading (#745) is the exception: not Argo's own claim, but one it is holding on to.
///
/// Held as a value with every transition returning a new set, so the store above it does nothing
/// but read one and write one.
public struct SessionAnnotations: Equatable, Sendable {
    /// One Session's annotations.
    public struct Annotation: Equatable, Sendable {
        public var isArchived: Bool
        /// The name the user gave this Session, `nil` for one they never named. Dropping the name
        /// IS the reset (#502, story 20) — there is no second flag saying whether it is in force.
        public var explicitName: String?
        /// What the code host last said about the Ticket this Session's branch names (#745).
        /// `nil` for a Session nobody has asked about yet. DERIVED, and kept apart from
        /// `explicitName` above because Argo writes this one and the user writes that one: merged,
        /// a resolve would silently overwrite a rename.
        public var ticket: TicketTitleReading?

        public init(
            isArchived: Bool = false,
            explicitName: String? = nil,
            ticket: TicketTitleReading? = nil,
        ) {
            self.isArchived = isArchived
            self.explicitName = SessionAnnotations.name(from: explicitName)
            self.ticket = ticket
        }

        /// An annotation that asserts nothing, which is what every Session has until somebody
        /// says otherwise. Never written to disk.
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

        /// And for the ticket.
        func reading(_ ticket: TicketTitleReading?) -> Annotation {
            var next = self
            next.ticket = ticket
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
    /// Public so the rename dialog decides it here too. Normalising here rather than at the
    /// dialog means a name from a hand-edited file obeys the same rule as one that was typed.
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

    /// What the code host said about this Session's ticket, and `nil` where nothing has asked.
    /// Which of the three a surface DRAWS is the projection's, on the ground `explicitName` is.
    public func ticket(_ sessionID: String) -> TicketTitleReading? {
        annotation(for: sessionID).ticket
    }

    /// Archive a Session, or put one back. Keyed on the chain id and on nothing observed, which
    /// is why re-reading a transcript cannot disturb it: a record arriving for an archived
    /// Session is new activity, and new activity is not a decision (#502, story 16).
    func archiving(_ isArchived: Bool, sessionID: String) -> SessionAnnotations {
        setting(annotation(for: sessionID).archived(isArchived), for: sessionID)
    }

    /// Name a Session, or drop the name it was given — the reset is `nil`, not a second verb
    /// (#502, story 20).
    func naming(_ name: String?, sessionID: String) -> SessionAnnotations {
        setting(annotation(for: sessionID).named(name), for: sessionID)
    }

    /// Hold what the code host said about a ticket. Never the user's gesture: the rename writes
    /// `naming` above.
    func reading(_ ticket: TicketTitleReading?, sessionID: String) -> SessionAnnotations {
        setting(annotation(for: sessionID).reading(ticket), for: sessionID)
    }

    /// The one write path, so an annotation that has fallen back to asserting nothing is dropped
    /// rather than left behind as a record of a decision that was undone.
    private func setting(_ annotation: Annotation, for sessionID: String) -> SessionAnnotations {
        var next = bySessionID
        next[sessionID] = annotation
        return SessionAnnotations(bySessionID: next)
    }
}
