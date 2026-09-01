@testable import ArgoUI
import Testing

/// One claim, over every way a roster moves: **the roster draws a current row for the Session the
/// deck renders, and for no other.** A roster marking one Session while the feed draws another is a
/// rendered lie rather than a cosmetic slip (`CONTEXT.md` Honesty tier), and it is the one defect
/// on this surface no render catches — each half looks right on its own.
///
/// Both halves are read where the shell reads them. What the deck renders is
/// `presentation.session(navigation.session)`: `SessionsRoomReading.taken(for:)`,
/// `InstrumentDeckShell.session` and `DeckVessel.resolve` all resolve exactly that. What the roster
/// draws is `RosterListing.Reading` plus `SessionRosterProjection.isArchiveOpen`, which is the one
/// answer `SessionNavigator` draws its rows and its ground from.
@Suite("The roster marks the Session the deck renders")
struct RosterMarksTheShownSessionTests {
    @Test
    func `selecting another Session moves the mark with the deck`() {
        let presentation = presentation(ids: "alpha", "beta")
        let navigation = navigation(over: presentation)

        navigation.session = "beta"

        expectAgreement(presentation, navigation, marks: "beta")
    }

    /// A Session that ended is still on the roster — story 14's rule, that Argo does not clear a
    /// row on a Session's behalf. So neither half moves.
    @Test
    func `the selected Session ending moves neither`() {
        var sessions = sessions(ids: "alpha", "beta")
        let navigation = navigation(over: presentation(sessions))

        navigation.session = "beta"
        sessions[1] = RosterSessionFixture.session(id: "beta", status: .ended)
        let ended = presentation(sessions)
        navigation.reconcile(against: ended.sessions.map(\.id))

        expectAgreement(ended, navigation, marks: "beta")
    }

    /// A Session the Hub stopped publishing. Reconciliation repoints, and the claim is that BOTH
    /// halves move — the mark lands on the first row and the deck reads the same one.
    @Test
    func `a Session dropped from the roster while selected hands the mark on`() {
        let navigation = navigation(over: presentation(ids: "alpha", "beta"))

        navigation.session = "beta"
        let shrunk = presentation(ids: "alpha")
        navigation.reconcile(against: shrunk.sessions.map(\.id))

        expectAgreement(shrunk, navigation, marks: "alpha")
    }

    /// Archiving the row being read — the state this suite was written for. The ids the shell
    /// reconciles against do NOT change, because an archived Session is still in the presentation,
    /// so nothing repoints and the deck goes on drawing it. The roster therefore has to go on
    /// drawing a row for it, which is what the foot opening for the selection buys.
    @Test
    func `archiving the selected Session keeps a row for it`() {
        var sessions = sessions(ids: "alpha", "beta")
        let navigation = navigation(over: presentation(sessions))

        navigation.session = "beta"
        sessions[1] = RosterSessionFixture.session(id: "beta", isArchived: true)
        let archived = presentation(sessions)
        navigation.reconcile(against: archived.sessions.map(\.id))

        expectAgreement(archived, navigation, marks: "beta")
    }

    /// The foot the reader shut stays shut over every row but that one: a foot that opened itself
    /// would put the cleared rows back under the ones that were kept.
    @Test
    func `an archive that does not hold the selection stays shut`() {
        let reading = reading(of: presentation(archiving: "beta"))

        #expect(
            SessionRosterProjection.isArchiveOpen(
                showing: false, selection: "alpha", in: reading.archived,
            ) == false,
        )
    }

    /// Nothing selected is not a reason to open it either — a fresh window with an archive behind
    /// its foot draws the foot shut.
    @Test
    func `no selection leaves the foot shut`() {
        let reading = reading(of: presentation(archiving: "beta"))

        #expect(
            SessionRosterProjection.isArchiveOpen(
                showing: false, selection: nil, in: reading.archived,
            ) == false,
        )
    }

    /// Picking the row already selected. It is a second EVENT — a refused resume is retried by
    /// clicking again (#10) — and it must not be a second decision about which row is current.
    @Test
    func `selecting the same Session twice marks it once`() {
        let presentation = presentation(ids: "alpha", "beta")
        let navigation = navigation(over: presentation)

        navigation.session = "beta"
        let first = navigation.chosenSession.ordinal
        navigation.session = "beta"

        #expect(navigation.chosenSession.ordinal == first + 1, "The second pick was not an event.")
        expectAgreement(presentation, navigation, marks: "beta")
    }

    // MARK: - The claim, and the shell's own wiring

    /// The roster's current row and the deck's Session, side by side. The expected id is NAMED, so
    /// two halves agreeing on the wrong Session still fails.
    private func expectAgreement(
        _ presentation: CockpitPresentation,
        _ navigation: CockpitNavigationModel,
        marks expected: String,
    ) {
        let marked = drawnRows(of: presentation, for: navigation.session)
            .filter { $0.id == navigation.session }

        #expect(marked.map(\.id) == [expected], "The roster draws no current row, or two.")
        #expect(
            presentation.session(navigation.session)?.id == marked.first?.id,
            "The roster marks one Session and the deck renders another.",
        )
    }

    /// Every row the roster actually DRAWS, as `SessionNavigator.body` draws them: the kept rows,
    /// and what is behind the foot only while the foot is open. `isArchiveShowing` is `false`
    /// because the foot is shut on launch and nothing here has clicked it.
    private func drawnRows(
        of presentation: CockpitPresentation,
        for selection: String?,
    )
        -> [SessionRosterProjection.Row] {
        let reading = reading(of: presentation)
        let isOpen = SessionRosterProjection.isArchiveOpen(
            showing: false, selection: selection, in: reading.archived,
        )
        return reading.rows + (isOpen ? reading.archived : [])
    }

    private func reading(of presentation: CockpitPresentation) -> RosterListing.Reading {
        RosterListing().reading(of: presentation.sessions)
    }

    /// A window as `CockpitView.body` leaves it on first draw: reconciled once, which is what
    /// points a fresh window at the first row.
    private func navigation(over presentation: CockpitPresentation) -> CockpitNavigationModel {
        let navigation = CockpitNavigationModel()
        navigation.reconcile(against: presentation.sessions.map(\.id))
        return navigation
    }

    private func sessions(ids: String...) -> [CockpitPresentation.Session] {
        ids.map { RosterSessionFixture.session(id: $0) }
    }

    private func presentation(ids: String...) -> CockpitPresentation {
        presentation(ids.map { RosterSessionFixture.session(id: $0) })
    }

    /// Two Sessions, the named one behind the foot.
    private func presentation(archiving id: String) -> CockpitPresentation {
        presentation([
            RosterSessionFixture.session(id: "alpha"),
            RosterSessionFixture.session(id: id, isArchived: true),
        ])
    }

    private func presentation(
        _ sessions: [CockpitPresentation.Session],
    )
        -> CockpitPresentation {
        CockpitPresentation(
            projects: [],
            activeProjectID: nil,
            sessions: sessions,
            checkout: .unavailable,
            connection: .idle,
        )
    }
}
