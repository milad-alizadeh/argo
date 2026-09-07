@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// What the roster PNGs are evidence OF — asserted so a fixture that stopped reaching a rendering
/// fails here rather than silently narrowing the only evidence those renderings have.
@Suite("Session roster specimens")
struct SessionRosterSpecimenTests {
    @Test
    func `the roster the specimen renders reaches every row rendering`() {
        // The `sessionRows` PNG is the only evidence roster states have, and it draws exactly
        // these rows.
        let rows = SessionRosterProjection.previewRows

        #expect(Set(rows.map(\.state)) == [.running, .attention, .idle, .failure, nil])
        // The ghosted row is also the long one: a title truncating on a quieter row.
        #expect(rows.contains { $0.isReadOnly && $0.title.count > 40 })
        // Both edges the clock takes (#1199), so the PNG is evidence of the rule and not of one
        // side of it: an activity line pushes the clock right, and a row without one keeps it
        // beside the fact the slot carries.
        #expect(rows.contains { $0.activity != nil && $0.clock != nil })
        #expect(rows.contains { $0.activity == nil && $0.clock != nil })
        // A long activity beside a clock: the line must give up its tail rather than push the
        // clock off the row.
        #expect(rows.contains { ($0.activity?.count ?? 0) > 30 && $0.clock != nil })
        // A Session on a detached checkout, located without a branch to name.
        #expect(rows.contains { $0.branch == nil })
        // A row with no clock that is not the running one, which would satisfy a bare `== nil`.
        #expect(rows.contains { $0.clock == nil && $0.state != .running })
    }

    @Test
    func `the Turn clock specimen reaches all three readings of the one slot`() {
        // The `turnClock` PNG is the only evidence the live and observed readings have
        // (`cockpit-roster-turn-clock.md`): the shared preview's running Session deliberately
        // carries no open-turn stamp, so it degrades and cannot render them.
        let rows = TurnClockRosterSpecimen.rows

        #expect(rows.contains {
            if case .turn = $0.clock {
                true
            } else {
                false
            }
        })
        #expect(rows.contains {
            if case .output = $0.clock {
                true
            } else {
                false
            }
        })
        #expect(rows.contains {
            if case .seen = $0.clock {
                true
            } else {
                false
            }
        })
        // The observed reading rides a ghosted row, as it always will in the app.
        #expect(rows.allSatisfy { row in
            if case .output = row.clock {
                row.isReadOnly
            } else {
                true
            }
        })
    }

    /// The `openFoldedRoster` PNG is the only evidence an OPENED fold has, so it has to be one:
    /// the id the specimen opens by is the projection's own, and this is what says so.
    @Test
    func `the opened folded roster the specimen renders is actually opened`() throws {
        let shut = FoldedRosterSpecimen.rows(opened: [])
        let opened = FoldedRosterSpecimen.rows(opened: FoldedRosterSpecimen.folds)

        #expect(try #require(shut.first { $0.fold != nil }).fold?.isOpen == false)
        #expect(try #require(opened.first { $0.fold != nil }).fold?.isOpen == true)
        #expect(opened.count > shut.count)
    }

    /// The same two PNGs are the only evidence #1567's readings have, so the fixture behind them
    /// has to still reach both: a caption with a failure clause, and runs the reader can tell
    /// apart once the fold is opened.
    @Test
    func `the folded roster the specimen renders says what its fold hid`() throws {
        let shut = FoldedRosterSpecimen.rows(opened: [])
        let opened = FoldedRosterSpecimen.rows(opened: FoldedRosterSpecimen.folds)

        #expect(try #require(shut.first { $0.fold != nil }).title.contains("failed"))
        // Distinct rows drawing what was one derived summary — the case the caption hid.
        let runs = opened.filter { $0.fold == nil && $0.isReadOnly }
        #expect(runs.count > 1)
        #expect(Set(runs.map(\.title)).count == runs.count)
        // And the failed ones are reachable under it, which is what the fold is for.
        #expect(runs.contains { $0.state == .failure })
    }

    @Test
    func `the specimen renders both badge words, so the two are judged side by side`() {
        #expect(
            Set(SessionRosterProjection.previewRows.compactMap(\.stateWord))
                == ["Needs input", "Stopped"],
        )
    }

    @Test
    func `the attention row the specimen renders is a Session held on a Permission`() {
        // Asserted on the status rather than the `Row`, which keeps only the word: `permission` and
        // `asking` share it, so a fixture drifting to `asking` would leave the PNG evidence for the
        // half that blocks nobody.
        #expect(CockpitPresentation.preview.sessions.contains { $0.status == .permission })
    }

    @Test
    func `the ghosted roster the specimen renders puts both accesses on one screen`() {
        // The `ghostedRows` PNG is the only evidence whole-row ghosting has, and it is a
        // COMPARISON: a list of nothing but read-only rows would prove nothing about the state.
        let rows = GhostedRosterSpecimen.rows

        #expect(rows.contains { $0.isReadOnly })
        #expect(rows.contains { !$0.isReadOnly })
        // Every element a row can draw has to appear ON a ghosted row, or the claim that the
        // row degrades as one is only rendered for half of it.
        #expect(rows.contains { $0.isReadOnly && $0.stateWord != nil })
        #expect(rows.contains { $0.isReadOnly && $0.activity != nil && $0.clock != nil })
        // A row with nothing on its second line but an age is the shortest thing the roster draws,
        // and ghosting has to reach it.
        #expect(rows.contains { $0.isReadOnly && $0.secondaryFact == nil && $0.clock != nil })
        // Including the loudest ink the roster has: a live dot on a Session nobody can steer.
        #expect(rows.contains { $0.isReadOnly && $0.state == .running })
    }

    /// `crowdedSpawningRoster` is the roster `OutlineCount.swift` polls for #1562, and its whole
    /// claim rests on the roster DRAWING a hundred rows. Rows sharing a title fold into one
    /// (#1073), so a crowd that folded would have the probe report "no spike" off a roster of a
    /// handful — the one wrong answer this repro can give.
    @MainActor
    @Test
    func `the crowded spawning roster draws a roster a spike could be seen against`() {
        let drawn = SessionRosterProjection.rows(from: SpawningRosterSpecimen.crowd, opened: [])

        #expect(drawn.count == 100)
        #expect(drawn.filter(\.takesSelection).count == drawn.count)
    }
}
