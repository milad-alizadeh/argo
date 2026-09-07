/// Which of a Session's names the cockpit shows — the one decision, in the one place. BOTH the
/// roster row's and the deck header's projections read it: `cockpit-spec.md` §4.2 — "Title
/// resolves through a stable fallback chain — explicit name → linked ticket → conversation-derived
/// … so rail and header always match" (#502 §Seams). #1072 spent a shared Ticket's words on only
/// one of its rows; #1391 held the header to that SAME spend rather than one taken in isolation,
/// so rail and header still always match. Which rows do the spending is the ROSTER's question —
/// `SessionRosterProjection.namedTitle(for:among:)` is the one route to it (#1251).
///
/// The derived summary is contested the same way, and for the same reason (#1567): a `-p` loop
/// sends one prompt template, so one derived summary names every row it wrote.
///
/// It is also where the title is SPELLED: whichever link of the chain answers, no title the
/// cockpit draws carries an em dash — see `spelled(_:)`.
///
/// Both edits this file makes — that spelling, and `toldApart`'s time-of-day prefix — now travel to
/// the CLI, because what `SessionNameMirror` types is what this resolves (#1623). They stay, and
/// #1623 point 4 asked for the reason rather than their removal. Each is load-bearing for a case
/// the unedited words cannot answer: the clock is the ONLY thing telling apart the 197 rows a `-p`
/// loop's one prompt template names identically (#1567), and the dash rewrite is what keeps a
/// subject and what is said about it legible at a roster row's width. Neither is a guess — both are
/// derived from facts Argo holds — so a phone showing them shows the same name the desk does, which
/// is the agreement #1623 is about. Dropping either one is its own ticket, and it has to answer the
/// case that put it here.
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
        namings(of: [session], against: [session])[0].title
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
        let tickets = ticketsDrawn(across: rivals)
        let contesting = Set(rivals.map(\.id))
        let spend = Spend(
            tickets: tickets,
            derived: derivedTitlesDrawn(across: rivals, tickets: tickets, contesting: contesting),
            contesting: contesting,
        )
        return sessions.map { naming(for: $0, spend: spend) }
    }

    /// What the rows the reader can SEE are already drawing — the Ticket words and the derived
    /// summaries together, decided once for the pass and read per row. One value, because a row's
    /// answer to the second question depends on its answer to the first: a row wearing its
    /// Ticket's sentence is not drawing a summary anybody can collide with.
    private struct Spend {
        let tickets: [Int: Int]
        let derived: [String: Int]
        let contesting: Set<CockpitPresentation.Session.ID>
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
        for session: CockpitPresentation.Session, spend: Spend,
    )
        -> Naming {
        let words = ticket(spentOn: session, spend: spend)
        let resetsTo = words.map(spelled) ?? toldApart(session, spend: spend)
        return Naming(
            // Reset's words are spelled the same way, so the dialog can never offer a title the
            // row would then draw differently.
            title: session.explicitName.map(spelled) ?? resetsTo,
            drawsDerivedTitle: session.explicitName == nil && words == nil,
            resetsTo: resetsTo,
        )
    }

    /// The Ticket's sentence where it names one row, and `nil` where the row falls through to its
    /// own summary — the chain's second link, asked once so nothing downstream re-decides it.
    private static func ticket(
        spentOn session: CockpitPresentation.Session, spend: Spend,
    )
        -> String? {
        namesOneRow(for: session, drawn: spend.tickets, contesting: spend.contesting)
            ? ticket(for: session)
            : nil
    }

    /// The derived summary a row draws, plus the fact that tells it from a row drawing the SAME
    /// one (#1567). Nothing contested the summary before, so a `-p` loop's 197 runs drew 197 rows
    /// of seven identical words and the failed one among them was one 8pt dot.
    ///
    /// The time of day, because a batch's runs differ by minutes and by nothing else. A run Argo
    /// read no start for keeps the bare summary rather than take an invented moment
    /// (`CONTEXT.md` L2 · degrade-down).
    ///
    /// It goes FIRST, which the render decided: the roster's title is one line truncating at the
    /// tail, and a summary long enough to collide is long enough to fill that line, so a clock
    /// behind it is clipped on every row that needed it. Fixed-width, so the sentences that
    /// follow it still start on one column.
    private static func toldApart(
        _ session: CockpitPresentation.Session, spend: Spend,
    )
        -> String {
        let summary = spelled(session.title)
        guard !namesOneRow(summary, for: session, spend: spend),
              let clock = TimeOfDayPhrase.phrase(atMs: session.startedAtMs)
        else { return summary }
        return clock + clockJoiner + summary
    }

    /// A middot, which is how the roster's other pairs spell two facts standing beside each
    /// other. The clock says nothing ABOUT the summary, so it takes no colon.
    private static let clockJoiner = " · "

    /// How many rows draw each derived summary as their title, counted the way `ticketsDrawn`
    /// counts Tickets: only where the row actually DRAWS it, so neither a renamed row nor one
    /// wearing its Ticket's sentence pushes a neighbour off its name.
    private static func derivedTitlesDrawn(
        across sessions: [CockpitPresentation.Session],
        tickets: [Int: Int],
        contesting: Set<CockpitPresentation.Session.ID>,
    )
        -> [String: Int] {
        // The counting pass reads the Ticket half alone, which is the half already settled.
        let spend = Spend(tickets: tickets, derived: [:], contesting: contesting)
        return sessions.reduce(into: [:]) { counts, session in
            guard drawsDerivedTitle(session, spend: spend) else { return }
            counts[spelled(session.title), default: 0] += 1
        }
    }

    /// Whether a row falls all the way through the chain to its own summary — the count above is
    /// of these rows alone.
    private static func drawsDerivedTitle(
        _ session: CockpitPresentation.Session, spend: Spend,
    )
        -> Bool {
        session.explicitName == nil && ticket(spentOn: session, spend: spend) == nil
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

    /// Whether this Session is the only row a Ticket's words would name.
    ///
    /// `byThisRow` only where the count HELD this row's draw: a Session outside the contesting set
    /// was never added to `drawn`, and taking one off there would hand it every Ticket a visible
    /// row is drawing.
    private static func namesOneRow(
        for session: CockpitPresentation.Session,
        drawn: [Int: Int],
        contesting: Set<CockpitPresentation.Session.ID>,
    )
        -> Bool {
        guard let number = session.ticket.link?.number else { return false }
        return drawnOnce(
            number, in: drawn,
            byThisRow: contesting.contains(session.id) && session.explicitName == nil,
        )
    }

    /// The same question of a derived summary. What counts as a draw is the only thing that
    /// differs: a Ticket is won at the chain's second link and a summary at its third.
    private static func namesOneRow(
        _ summary: String, for session: CockpitPresentation.Session, spend: Spend,
    )
        -> Bool {
        drawnOnce(
            summary, in: spend.derived,
            byThisRow: spend.contesting.contains(session.id)
                && drawsDerivedTitle(session, spend: spend),
        )
    }

    /// The arithmetic both contests are: a key drawn by exactly one row, asked of a row that may
    /// be drawing it itself. Its own draw comes out of the count, so a renamed row — which draws
    /// nothing now, and would draw the moment Reset takes its name off — is asked exactly the
    /// question Reset will make true.
    private static func drawnOnce<Key: Hashable>(
        _ key: Key, in drawn: [Key: Int], byThisRow: Bool,
    )
        -> Bool {
        drawn[key, default: 0] - (byThisRow ? 1 : 0) == 0
    }
}
