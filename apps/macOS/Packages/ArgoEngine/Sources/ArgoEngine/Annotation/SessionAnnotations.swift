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
        /// The Ticket a reader attached to this Session by hand, `nil` for one they never did
        /// (#1092). The user's own gesture, so DIRECT — and the only link a Session gets when
        /// nothing about its branch or its folder names a number, which is most of them.
        ///
        /// Beside `ticket` above rather than folded into it, on `explicitName`'s reasoning: Argo
        /// writes the title and the user writes the number, and one slot for the two would let a
        /// resolve overwrite a decision.
        public var pinnedTicket: Int?

        public init(
            isArchived: Bool = false,
            explicitName: String? = nil,
            ticket: TicketTitleReading? = nil,
            pinnedTicket: Int? = nil,
        ) {
            self.isArchived = isArchived
            self.explicitName = SessionAnnotations.name(from: explicitName)
            self.ticket = ticket
            self.pinnedTicket = SessionAnnotations.ticketNumber(from: pinnedTicket)
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

        /// And for the pin — which also DROPS the held title (#1092). The title was read for the
        /// number that was there before, so a pin moved to another ticket keeping it would print
        /// one ticket's words under another ticket's number until the next resolve.
        func pinned(_ number: Int?) -> Annotation {
            var next = self
            next.pinnedTicket = SessionAnnotations.ticketNumber(from: number)
            guard next.pinnedTicket != pinnedTicket else { return next }
            next.ticket = nil
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

    /// The Ticket a reader attached to this Session by hand, and `nil` where they never did
    /// (#1092). Which link WINS is the projection's, the way the title's rendering is.
    public func pinnedTicket(_ sessionID: String) -> Int? {
        annotation(for: sessionID).pinnedTicket
    }

    /// A ticket number is a positive integer, and nothing else is one. Public for the same reason
    /// `name(from:)` is: a number out of a hand-edited file obeys the rule a picked one does.
    public static func ticketNumber(from number: Int?) -> Int? {
        guard let number, number > 0 else { return nil }
        return number
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

    /// Attach a Session to a Ticket by hand, or — with `nil` — drop the attachment and let whatever
    /// its branch names come back (#1092). The reset is `nil`, on `naming` above's reasoning.
    func pinning(_ number: Int?, sessionID: String) -> SessionAnnotations {
        setting(annotation(for: sessionID).pinned(number), for: sessionID)
    }

    /// The one write path, so an annotation that has fallen back to asserting nothing is dropped
    /// rather than left behind as a record of a decision that was undone.
    private func setting(_ annotation: Annotation, for sessionID: String) -> SessionAnnotations {
        var next = bySessionID
        next[sessionID] = annotation
        return SessionAnnotations(bySessionID: next)
    }
}
