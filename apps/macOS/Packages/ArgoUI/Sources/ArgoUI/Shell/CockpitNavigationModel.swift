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

    /// Point the window at a Session Argo has just STARTED, whose row the roster has not published
    /// yet (#1493).
    ///
    /// Every spawn answers with a `SessionOwnership.ClaimID`, and the shell is handed it the
    /// instant the process is up — which is before the provisional row has reached the
    /// presentation, and well before the CLI's first record re-keys that row (#361). At least one
    /// reconciliation runs in between, and on ids alone that pass cannot tell a Session that is
    /// COMING from one that has gone: both are ids no row accounts for. Falling back there took
    /// the deck and the ground off the fresh Session before it ever had a row, which is the state
    /// the report describes.
    ///
    /// So the act says which it is. Nothing else can: the answer is about what the caller just
    /// did, not about anything either the roster or the id can be asked.
    func pointAtStarting(_ id: CockpitPresentation.Session.ID) {
        session = id
        awaitedSession = id
    }

    private func pick(_ id: CockpitPresentation.Session.ID?) {
        pointedSession = id
        // Any other write is the reader pointing at a Session that already exists, so a wait left
        // over from a spawn they have since moved off is over.
        awaitedSession = nil
        chosenSession = Pick(session: id, ordinal: chosenSession.ordinal + 1)
    }

    /// The pointed id whose first row is still on its way, and `nil` the rest of the time.
    ///
    /// Read by the roster as well as by reconciliation: the list confines its selection to the
    /// rows it is DRAWING (`RowSelectionReactions`), and a row that has not been published yet is
    /// not drawn — so without this the list drops the selection a spawn just made and drags the
    /// deck along with it, whatever reconciliation decides (#1493).
    private(set) var awaitedSession: CockpitPresentation.Session.ID?

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
    /// Four answers, in this order. A pointed id still on the roster stands. One a row has
    /// ABSORBED has not left — the reader is on the same Session under the id it is published as
    /// now (#1481) — so the selection follows it there, which is no more a repoint than the row
    /// redrawing and is not treated as one.
    ///
    /// An id whose Session Argo has just STARTED has not arrived yet rather than left, and is held
    /// where it is until its row is published (`pointAtStarting`, #1493).
    ///
    /// Only an id no row accounts for and none is coming for has genuinely gone, and then the
    /// selection lands on the row
    /// nearest where it was: the first below it still on the roster, and the one above only where
    /// nothing below it is. Never the first row — the roster is ordered newest-activity first
    /// (#1402), so its first row is whichever Session last did something, and landing there is how
    /// a reader ends up reading the Session that has just appeared.
    func reconcile(against roster: [RosterIdentity]) {
        defer { lastRoster = roster }
        follow(Self.succession(of: roster))
        let sessionIDs = roster.map(\.id)
        if let pointedSession, sessionIDs.contains(pointedSession) {
            // The row it was waiting for. From here it is an ordinary published id, and the next
            // pass that cannot find it is a Session that genuinely went.
            awaitedSession = nil
            sessionSelection.confine(to: sessionIDs)
            return
        }
        // A Session Argo has started and the roster has not published yet is not a Session that
        // left (#1493) — see `pointAtStarting`. Nothing is confined either: the selection holds an
        // id that is about to be published, and confining would drop it.
        if awaitedSession != nil {
            return
        }
        // Whatever happens to the deck's row, a Session that has left cannot stay selected: the
        // menu would be offering to archive rows nobody can see (#1247).
        sessionSelection.confine(to: sessionIDs)
        let landing = Self.neighbour(of: pointedSession, in: lastRoster, among: roster)
            ?? roster.first { !$0.isArchived }?.id
        pointedSession = landing
        sessionSelection.point(at: landing)
        chosenSession = Pick(session: nil, ordinal: chosenSession.ordinal + 1)
    }

    /// The whole selection onto the rows that took its ids over. `chosenSession` is deliberately
    /// left alone: it records the act of PICKING, the reader performed none here, and writing it
    /// would fire `resumeIfSelectionIsDead` — a resume nobody asked for (#10).
    private func follow(_ succession: [RowID: RowID]) {
        sessionSelection.follow(succession)
        if let pointed = pointedSession, let heir = succession[pointed] {
            pointedSession = heir
        }
    }

    /// Which row took each retired id over.
    private static func succession(of roster: [RosterIdentity]) -> [RowID: RowID] {
        roster.reduce(into: [:]) { heirs, row in
            for absorbed in row.absorbedIDs {
                heirs[absorbed] = row.id
            }
        }
    }

    /// The row nearest where the departed one stood, over the order the roster last had. Archived
    /// rows are passed over: they are on the roster and may still be SELECTED, but they sit behind
    /// a disclosure, and repointing the reader at a row they cannot see is the bug this rule is
    /// about wearing a different coat. A roster this model never saw the previous shape of answers
    /// `nil`, which is a launch.
    ///
    /// Folds are the sidebar's own state (`ShellSidebar.openFolds`) and out of reach here, so a
    /// folded row can still be landed on. It is a row of a Session the reader CAN reach, unlike an
    /// archived one — see the PR for #1481.
    private static func neighbour(
        of departed: RowID?,
        in lastRoster: [RosterIdentity],
        among live: [RosterIdentity],
    )
        -> RowID? {
        guard let departed, let row = lastRoster.firstIndex(where: { $0.id == departed })
        else { return nil }
        let landable = Set(live.lazy.filter { !$0.isArchived }.map(\.id))
        return lastRoster[lastRoster.index(after: row)...].first { landable.contains($0.id) }?.id
            ?? lastRoster[..<row].last { landable.contains($0.id) }?.id
    }

    /// The roster's own key, spelled once: the generic pair below reads as noise otherwise.
    private typealias RowID = CockpitPresentation.Session.ID

    /// The roster as it stood when it was last reconciled, which is the only thing that can say
    /// what a departed row's neighbour WAS. Unobserved because nothing renders it: it is this
    /// model's own memory of the last pass.
    @ObservationIgnored private var lastRoster: [RosterIdentity] = []
}
