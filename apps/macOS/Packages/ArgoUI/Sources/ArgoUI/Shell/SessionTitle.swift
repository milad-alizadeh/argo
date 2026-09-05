/// Which of a Session's names the cockpit shows — the one decision, in the one place. BOTH the
/// roster row's and the deck header's projections read it: `cockpit-spec.md` §4.2 — "Title
/// resolves through a stable fallback chain — explicit name → linked ticket → conversation-derived
/// … so rail and header always match" (#502 §Seams). #1072 spent a shared Ticket's words on only
/// one of its rows; #1391 held the header to that SAME spend rather than one taken in isolation,
/// so rail and header still always match. Which rows do the spending is the ROSTER's question —
/// `SessionRosterProjection.namedTitle(for:among:)` is the one route to it (#1251).
///
/// It is also where the title is SPELLED: whichever link of the chain answers, no title the
/// cockpit draws carries an em dash — see `spelled(_:)`.
enum SessionTitle {
    /// What one row is called, and what the surface drawing it must ask beside the words.
    struct Naming {
        let title: String
        /// Whether the title is the Session's own derived name rather than the Ticket's words.
        let drawsDerivedTitle: Bool
        /// The title with the explicit name taken out — where the rename dialog's Reset goes.
        /// Settled in the same pass, so Reset can never promise words the row would not draw.
        let resetsTo: String
    }

    /// `explicit → ticket → derived` (#502, story 19) for a caller with no roster to hand —
    /// isolated fixtures and tests, and a single Session that is the whole roster it is drawn in.
    /// A caller that HAS the roster must go through
    /// `SessionRosterProjection.namedTitle(for:among:)` instead (#1391): a Session drawn against
    /// only itself always reads as if its Ticket names it alone.
    static func resolved(for session: CockpitPresentation.Session) -> String {
        naming(
            for: session, drawn: ticketsDrawn(across: [session]), contesting: [session.id],
        ).title
    }

    /// The name each roster row draws, decided across the WHOLE roster in one pass — the way
    /// `SessionRosterProjection.worktrees(of:)` already decides workspace labels.
    ///
    /// A Ticket's words are spent on a title only where they name ONE row; where two or more rows
    /// would draw them, each takes its own derived name and the Ticket rides the secondary line
    /// (#1072). The chain is #745's, held to the case it is true in.
    static func namings(across sessions: [CockpitPresentation.Session]) -> [Naming] {
        namings(of: sessions, against: sessions)
    }

    /// The same decision where the rows that CONTEST a Ticket's words are not the rows being
    /// named: only a row the reader can actually see spends a Ticket, so a roster pass names
    /// every Session it holds against the visible ones alone (#1251).
    ///
    /// A Session outside `rivals` draws no words of its own, so it neither takes them from
    /// anybody nor is asked to give up ones nothing else is drawing.
    static func namings(
        of sessions: [CockpitPresentation.Session],
        against rivals: [CockpitPresentation.Session],
    )
        -> [Naming] {
        let drawn = ticketsDrawn(across: rivals)
        let contesting = Set(rivals.map(\.id))
        return sessions.map { naming(for: $0, drawn: drawn, contesting: contesting) }
    }

    /// The linked Ticket's own sentence, and nothing else (#1347): the number that used to ride
    /// beside it here now draws on line 3, beside the pull request (#1346) — a title carrying both
    /// read as one run against two tickets the moment a pull request landed on the same row.
    ///
    /// `nil` for a link the provider has not named, and not `#741` alone: a bare number carries no
    /// more than the `/implement 741` it would be replacing, and it costs the reader the words.
    private static func ticket(for session: CockpitPresentation.Session) -> String? {
        session.ticket.link?.title
    }

    /// How many rows draw each Ticket's words as their title. A row that draws something else is
    /// not counted, so a silent row cannot push its neighbours off their names.
    private static func ticketsDrawn(
        across sessions: [CockpitPresentation.Session],
    )
        -> [Int: Int] {
        sessions.reduce(into: [:]) { drawn, session in
            guard session.explicitName == nil, ticket(for: session) != nil,
                  let number = session.ticket.link?.number
            else { return }
            drawn[number, default: 0] += 1
        }
    }

    private static func naming(
        for session: CockpitPresentation.Session,
        drawn: [Int: Int],
        contesting: Set<CockpitPresentation.Session.ID>,
    )
        -> Naming {
        let names = namesOneRow(for: session, drawn: drawn, contesting: contesting)
        let words = names ? ticket(for: session) : nil
        let resetsTo = spelled(words ?? session.title)
        return Naming(
            // Reset's words are spelled the same way, so the dialog can never offer a title the
            // row would then draw differently.
            title: session.explicitName.map(spelled) ?? resetsTo,
            drawsDerivedTitle: session.explicitName == nil && words == nil,
            resetsTo: resetsTo,
        )
    }

    /// No em dash in a title the cockpit draws. It arrives from all three links of the chain — a
    /// CLI's own derived summary, a provider's issue title, and a name somebody typed — so it is
    /// taken out HERE, where the chain resolves, rather than three times over.
    ///
    /// `IssueReading.joiner` and not a hyphen: the dash was setting a subject against what is said
    /// about it, which is that separator's own job, and a hyphen at that width reads as part of a
    /// word. The space before it goes with it, so `Roster row — the pulse` reads
    /// `Roster row: the pulse`.
    private static func spelled(_ title: String) -> String {
        guard title.contains(emDash) else { return title }
        let parts = title
            .split(separator: emDash, omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        // A title that was nothing BUT dashes keeps what it had: a blank row says less than a
        // strange one, and there is no reading behind an empty name to fall back to.
        return parts.isEmpty ? title : parts.joined(separator: IssueReading.joiner)
    }

    private static let emDash: Character = "—"

    /// Whether this Session is the only row a Ticket's words would name. Its own draw comes out of
    /// the count, so a renamed row — which draws no words now, and would draw them the moment
    /// Reset takes its name off — is asked exactly the same question.
    ///
    /// Only where the count HELD its draw: a Session outside the contesting set was never added
    /// to `drawn`, and taking one off there would hand it every Ticket a visible row is drawing.
    private static func namesOneRow(
        for session: CockpitPresentation.Session,
        drawn: [Int: Int],
        contesting: Set<CockpitPresentation.Session.ID>,
    )
        -> Bool {
        guard let number = session.ticket.link?.number else { return false }
        let draws = contesting.contains(session.id) && session.explicitName == nil
        return drawn[number, default: 0] - (draws ? 1 : 0) == 0
    }
}
