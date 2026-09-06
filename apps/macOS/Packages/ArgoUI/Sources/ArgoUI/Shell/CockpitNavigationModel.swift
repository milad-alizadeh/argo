import ArgoEngine
import CoreGraphics
import Observation

/// Where one cockpit window is pointing: the room on screen and the Session it has selected.
///
/// Holds ids only, never model values — restoration reads a stale id and repoints, it never
/// resurrects a Session that no longer exists.
@Observable
public final class CockpitNavigationModel {
    /// The one field the app target touches: its Navigate menu sets the room.
    public var room: CockpitRoom = .sessions

    /// The ticket the Tickets room is open on. Beside the Session and not inside it: a room keeps
    /// where it was pointing while the reader is in another one.
    package var ticket: Int? {
        get { openTicketNumber }
        set {
            openTicketNumber = newValue
            // Everything that writes this opens the pane from outside the backlog — a link, the
            // detail pane's own child rows, a restore — and that is one click's worth of
            // selection, never an addition to the range the reader built (#1247).
            ticketSelection.point(at: newValue)
        }
    }

    /// The backlog's whole selection, which the open ticket above is the last click out of
    /// (#1247). Beside the open ticket rather than derived from it, for the roster's own reason.
    var ticketSelection = RowSelection<Int>()

    private var openTicketNumber: Int?

    /// The pane opened by a click the backlog has ALREADY settled the selection for. The setter
    /// above cannot serve that: it would collapse the range the same click just made.
    func paneOpened(at number: Int?) {
        openTicketNumber = number
    }

    /// Which of the backlog's views is open. Here rather than in the sidebar, because it decides
    /// what the DECK draws — held inside the sidebar it filtered nothing.
    var ticketsView = TicketsView.allOpen
    /// Which parents the backlog has folded. Beside the view for the same reason: a fold survives
    /// the reader leaving the room. Empty, because everything opens open (#814).
    var shutParents: Set<Int> = []
    /// What the backlog's search field is holding. Beside the view for its reason: the field sits
    /// over the ticket and narrows the LIST, so neither pane may own it (#816).
    var ticketsQuery = ""
    /// What the reader has dragged the Tickets room's seam to. A preference of the WINDOW, like the
    /// deck's own seams (`DeckSeams`) — the room's two panes are rebuilt on every ticket, and a
    /// width owned inside that subtree would lose the drag on every click.
    var backlogWidth = ArgoBacklogList.width

    /// The Session on screen. Every write but reconciliation's is somebody picking a row, which is
    /// why the setter records one.
    ///
    /// Public because the app target reads it, like `room` above: selecting a Session is what makes
    /// Argo read its record whole, and the Hub is the app's to touch (`Hub.readSelected`).
    public var session: CockpitPresentation.Session.ID? {
        get { pointedSession }
        set {
            pick(newValue)
            // Everything that writes this is pointing the window from OUTSIDE the roster — a
            // link, a reveal, the menu bar — and that is one click's worth of selection, never an
            // addition to the range the reader built (#1247).
            sessionSelection.point(at: newValue)
        }
    }

    /// The roster's whole selection, which the deck's row above is the last click out of (#1247).
    /// Held beside `session` rather than derived from it: a range of four rows has one deck row,
    /// and the deck may not be moved by growing a range.
    var sessionSelection = RowSelection<CockpitPresentation.Session.ID>()

    /// The deck moved by a click the roster has ALREADY settled the selection for. The setter
    /// above cannot serve that: it would collapse the range the same click just made.
    func deckPointed(at id: CockpitPresentation.Session.ID?) {
        pick(id)
    }

    private func pick(_ id: CockpitPresentation.Session.ID?) {
        pointedSession = id
        chosenSession = Pick(session: id, ordinal: chosenSession.ordinal + 1)
    }

    /// One act of picking a row. The ordinal is what makes picking the SAME row twice two events:
    /// a resume that was refused is retried by clicking again (#10), and on the id alone the second
    /// click would be no change at all.
    struct Pick: Equatable {
        var session: CockpitPresentation.Session.ID?
        var ordinal = 0
    }

    /// What the user PICKED, as opposed to what reconciliation landed on. Resuming a dead Session
    /// is an act of theirs, so a roster that repointed itself must start no agent — and at launch
    /// it repoints itself onto the first row.
    private(set) var chosenSession = Pick(session: nil)

    private var pointedSession: CockpitPresentation.Session.ID?

    public init() {}

    /// What a Project switch takes with it: the query alone, because it is the one thing here that
    /// is a question about a particular Project's tickets (#873). The view, the fold and the seam
    /// are the reader's own settings and stand.
    func projectSwitched() {
        ticketsQuery = ""
    }

    /// What the tab line's Issue link does (#1092) — point the window at the Ticket and switch
    /// into its room, the mirror of `TicketsRoom.openSession`. A named method rather than an
    /// inline closure, so the round trip with `TicketsRoom.openSession` is testable without
    /// rendering a view.
    func openTicket(_ number: Int) {
        ticket = number
        room = .tickets
    }

    /// Repoints a selection that no longer names a live Session. An empty roster leaves it `nil` —
    /// there is nothing honest to point at.
    ///
    /// Three answers, in this order. A pointed id still on the roster stands. One a row has
    /// ABSORBED has not left: the sweep that found its origin folded it into that row, and the
    /// reader is on the same Session under the id it is now published as (#1481). The selection
    /// follows it there, which is no more a repoint than the row redrawing, so nothing here treats
    /// it as one.
    ///
    /// Only an id no row accounts for has genuinely gone, and then the selection lands on the row
    /// nearest where it was — never on the first. The roster is ordered newest-activity first
    /// (#1402), so the first row is the one most likely to move again, and it is whichever Session
    /// last did something: landing there is how a reader ends up reading the Session that has just
    /// appeared.
    func reconcile(against roster: [RosterIdentity]) {
        let sessionIDs = roster.map(\.id)
        defer { lastRoster = sessionIDs }
        follow(Self.succession(of: roster))
        // Whatever happens to the deck's row, a Session that has left cannot stay selected: the
        // menu would be offering to archive rows nobody can see (#1247).
        sessionSelection.confine(to: sessionIDs)
        if let pointedSession, sessionIDs.contains(pointedSession) {
            return
        }
        let landing = Self.neighbour(of: pointedSession, in: lastRoster, among: sessionIDs)
            ?? sessionIDs.first
        pointedSession = landing
        sessionSelection.point(at: landing)
        chosenSession = Pick(session: nil, ordinal: chosenSession.ordinal + 1)
    }

    /// The whole selection onto the rows that took its ids over. `chosenSession` is deliberately
    /// left alone: it records the act of PICKING, the reader performed none here, and writing it
    /// would fire `resumeIfSelectionIsDead` — a resume nobody asked for, which is the one thing a
    /// repoint must never start (#10).
    private func follow(_ succession: [CockpitPresentation.Session.ID: CockpitPresentation.Session
            .ID]) {
        sessionSelection.follow(succession)
        pointedSession = pointedSession.flatMap { succession[$0] } ?? pointedSession
    }

    /// Which row took each absorbed id over.
    private static func succession(
        of roster: [RosterIdentity],
    )
        -> [CockpitPresentation.Session.ID: CockpitPresentation.Session.ID] {
        roster.reduce(into: [:]) { heirs, row in
            for absorbed in row.absorbedIDs {
                heirs[absorbed] = row.id
            }
        }
    }

    /// The row nearest where the departed one stood, read off the order the roster last had: the
    /// first survivor BELOW it, and the one above only where nothing below it survived. The rule
    /// every list the reader already uses keeps, and the one place a repoint has anything to go on
    /// — a roster this model never saw the previous shape of answers `nil`, which is a launch.
    private static func neighbour(
        of departed: CockpitPresentation.Session.ID?,
        in lastRoster: [CockpitPresentation.Session.ID],
        among live: [CockpitPresentation.Session.ID],
    )
        -> CockpitPresentation.Session.ID? {
        guard let departed, let row = lastRoster.firstIndex(of: departed) else { return nil }
        let surviving = Set(live)
        return lastRoster[lastRoster.index(after: row)...].first { surviving.contains($0) }
            ?? lastRoster[..<row].last { surviving.contains($0) }
    }

    /// The order the roster had when it was last reconciled, which is the only thing that can say
    /// what a departed row's neighbour WAS. Ids alone, because that is the whole question, and
    /// unobserved because nothing renders it: it is this model's own memory of the last pass.
    @ObservationIgnored private var lastRoster: [CockpitPresentation.Session.ID] = []
}
