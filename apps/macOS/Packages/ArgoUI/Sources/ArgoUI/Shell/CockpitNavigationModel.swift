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
    /// Where a backlog question has got to (#1317). Beside the query for the query's own reason:
    /// the room's two panes are rebuilt on every ticket, and an answer owned inside that subtree
    /// would be lost by the first click that changed anything.
    ///
    /// **Not held across a Project switch or a room switch** — see `projectSwitched`. A question
    /// is not the Project's, and an answer about one backlog left standing over another would be
    /// the false DIRECT the tier rules exist to refuse.
    var backlogAsk = BacklogAsk.State.unasked
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
        // Written after the two above, because `session`'s setter runs `pick`, which clears both.
        startedClaim = id
        rosterBeforeStart = Set(lastRoster.map(\.id))
    }

    private func pick(_ id: CockpitPresentation.Session.ID?) {
        pointedSession = id
        // Any other write is the reader pointing at a Session that already exists, so a wait left
        // over from a spawn they have since moved off is over.
        awaitedSession = nil
        startedClaim = nil
        rosterBeforeStart = []
        chosenSession = Pick(session: id, ordinal: chosenSession.ordinal + 1)
    }

    /// The pointed id whose first row is still on its way, and `nil` the rest of the time.
    ///
    /// Read by the roster: the list confines its selection to the rows it is DRAWING
    /// (`RowSelectionReactions`), and a row that has not been published yet is not drawn — so
    /// without this the list drops the selection a spawn just made and drags the deck along with
    /// it, whatever reconciliation decides (#1493).
    ///
    /// It ends at the FIRST row, and it has to: the exemption it buys is from a cut over rows the
    /// list has no entry for, and a row the list has and is withholding behind a shut fold must
    /// still be cut (`RowSelectionHold.confineToDrawn`, #1247). What reconciliation guards on is
    /// `startedClaim`, which outlives this — see there for why the two are not one field (#1602).
    private(set) var awaitedSession: CockpitPresentation.Session.ID?

    /// The claim id a spawn of Argo's own is standing under, until the id under it stops moving.
    ///
    /// A ticket start retires its id TWICE (#1602). The provisional row is published under the
    /// claim, which ends `awaitedSession` above, and the claim is then retired a second time for
    /// the id the CLI picked (`HubSession.absorbedIDs`, #361). Only succession stood over that
    /// second retirement, and succession is empty for any pass that rebuilt the presentation
    /// between the CLI's record landing and the sweep that binds it: the claim is then on no roster
    /// and absorbed by nothing, reconciliation reads a Session that left, and the window lands on
    /// the departed row's neighbour — the "different Session" the report describes.
    ///
    /// So the hold ends where the id stops moving. A claim id means nothing outside the process
    /// that issued it (`SessionOwnership.isClaimID`) and is guaranteed to be retired; the id the
    /// CLI picked is a transcript's own key and nothing retires it after.
    ///
    /// Set by `pointAtStarting` alone, which is the bound on it. A claim row the READER merely
    /// clicked gets no hold, so a foreign spawn that dies before writing a record still falls to
    /// the neighbour rule rather than leaving the roster grounding nothing.
    @ObservationIgnored private var startedClaim: CockpitPresentation.Session.ID?

    /// The ids already published when that spawn was started. A Session Argo has only just started
    /// cannot be one of them, which is the one thing that tells a real re-key from the edge a
    /// RECYCLED claim id forges — see `trusted`. Unobserved: nothing draws it.
    @ObservationIgnored private var rosterBeforeStart: Set<CockpitPresentation.Session.ID> = []

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
    @MainActor func projectSwitched() {
        ticketsQuery = ""
        // The answer goes with it, and the child running behind one goes first: a question about
        // twelve tickets nobody is looking at any more is spend on a model for nothing.
        stopAsking()
    }

    /// Put a question in flight, replacing whatever was on screen. The caller owns the work; this
    /// owns the handle, so `stopAsking` has one thing to cancel and the surface has one place the
    /// state comes from.
    @MainActor func asking(
        _ question: String,
        over work: @escaping @MainActor () async -> BacklogQuestion.Reply?,
    ) {
        backlogAskWork?.cancel()
        backlogAsk = .asking(question: question)
        backlogAskWork = Task { @MainActor in
            let reply = await work()
            // A cancelled question has already been answered by `stopAsking` — writing here would
            // put the sheet back up over the room the reader just cleared.
            guard !Task.isCancelled else { return }
            backlogAsk = reply.map {
                .answered(question: question, prose: $0.prose, read: $0.wasRead)
            } ?? .unasked
        }
    }

    /// Stop a question in flight and put the room back exactly as it was, or dismiss an answer
    /// that arrived — one method, because both end at the same state and leaving a cancelled task
    /// behind an already-closed sheet is the bug the two would share.
    @MainActor func stopAsking() {
        backlogAskWork?.cancel()
        backlogAskWork = nil
        backlogAsk = .unasked
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
    /// where it is until its row is standing under the id it will keep (`pointAtStarting`, #1493,
    /// and `startedClaim`, #1602).
    ///
    /// Only an id no row accounts for and none is coming for has genuinely gone, and then the
    /// selection lands on the row
    /// nearest where it was: the first below it still on the roster, and the one above only where
    /// nothing below it is. Never the first row — the roster is ordered newest-activity first
    /// (#1402), so its first row is whichever Session last did something, and landing there is how
    /// a reader ends up reading the Session that has just appeared.
    func reconcile(against roster: [RosterIdentity]) {
        defer { lastRoster = roster }
        follow(trusted(Self.succession(of: roster)))
        let sessionIDs = roster.map(\.id)
        if let pointedSession, sessionIDs.contains(pointedSession) {
            // The row it was waiting for. From here it is an ordinary published id, and the next
            // pass that cannot find it is a Session that genuinely went.
            awaitedSession = nil
            // Unless the row is still standing under the CLAIM, which is the first of this route's
            // two retirements and not the arrival (#1602) — see `startedClaim`.
            if !SessionOwnership.isClaimID(pointedSession) {
                startedClaim = nil
                rosterBeforeStart = []
            }
            sessionSelection.confine(to: sessionIDs)
            return
        }
        // A Session Argo has started is not a Session that left (#1493, #1602) — see
        // `pointAtStarting`, and `startedClaim` for why this outlasts the row's first publish.
        // Nothing is confined either: the selection holds an id that is about to be published or
        // re-keyed, and confining would drop it.
        if startedClaim != nil {
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

    /// The same map with the one edge a RECYCLED claim id can forge taken out of it (#1563).
    ///
    /// A claim is `claim-<launch>-<n>` and the counter restarts with the process, so an older
    /// Session's `absorbedIDs` can hold the exact string a fresh spawn was just issued. Nothing in
    /// the map itself can tell that edge from a real one — but the pointer can be asked what it is
    /// waiting for. A row Argo started moments ago cannot be one that was already published when
    /// the press happened, so an heir standing there was never this spawn, and the claim is left
    /// where it is: holding the window rather than handing it to somebody else's Session (#1602).
    ///
    /// Only the started claim's own edge is dropped. Every other succession is a continuation the
    /// reader was genuinely pointed at, and its heir having stood on the roster already is the
    /// normal case for one (#1481).
    private func trusted(_ succession: [RowID: RowID]) -> [RowID: RowID] {
        guard let claim = startedClaim, let heir = succession[claim],
              rosterBeforeStart.contains(heir)
        else { return succession }
        var trusted = succession
        trusted[claim] = nil
        return trusted
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

    /// The question in flight, so `Stop` has something to cancel. Ignored by observation because
    /// nothing draws the handle — `backlogAsk` is what the surface reads, and a task that also
    /// published would redraw the room on every state it passes through.
    @ObservationIgnored private var backlogAskWork: Task<Void, Never>?
}
