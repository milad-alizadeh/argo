/// The Issue row's own types, split out of `Header` so its body stays under the length cap
/// (`.swiftlint.yml`) — read alongside `SessionHeaderProjection+HeaderValues.swift`.
extension SessionHeaderProjection.Header {
    /// What the Issue row draws. The row used to VANISH where nothing was linked, which told
    /// a reader nothing about whether there was a link to expect or a branch to repair.
    ///
    /// Two cases and not three, unlike the reading behind it: `unread` has no row at all, and
    /// that is the header's `nil` above. The optional is a RENDERING absence — draw nothing
    /// here — where `TicketLinkReading.unread` is a domain one, and folding them into one
    /// enum would make every reader of this type answer a question about the Binding.
    enum IssueRow: Equatable, Sendable {
        case link(IssueLink)
        /// A provider is bound and nothing named a Ticket for this Session.
        case unlinked

        /// The link where the row is one, for the surfaces that draw only a link.
        var link: IssueLink? {
            switch self {
            case let .link(link): link
            case .unlinked: nil
            }
        }

        /// What the row reads as, on the line and out loud. Never blank: a row that draws
        /// nothing is the absence #894 replaced.
        var label: String {
            switch self {
            case let .link(link): link.label
            case .unlinked: SessionHeaderProjection.Header.unlinkedWord
            }
        }

        /// The title behind the link, and nothing for the row that is not one.
        var detail: String? {
            link?.detail
        }
    }

    /// What an unlinked Session's Issue row says. States the reading rather than blaming the
    /// Session: Argo could not name a Ticket for it, and cutting a branch that says which one
    /// is the repair.
    static let unlinkedWord = "No ticket linked"

    /// …and what it says instead once there IS a backlog to pick from (#1092). The ellipsis is
    /// the only thing on this line that says a press opens a choice rather than a room, and the
    /// word is a verb because the reading above is one a reader can now act on.
    static let linkVerb = "Link a ticket…"

    /// The linked Ticket as the header says it: `Issue #400`, never a bare `#400`. The
    /// detail is the issue's own title where the provider gave one, absent where it did not.
    struct IssueLink: Equatable, Sendable {
        /// Beside the label, so the ⓘ panel can say the bare `#476` under a term that already
        /// says `Issue` without unpicking the label to get at it.
        let number: Int
        let label: String
        let detail: String?
    }
}
