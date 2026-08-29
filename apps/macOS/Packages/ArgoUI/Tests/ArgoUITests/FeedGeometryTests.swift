import AppKit
@testable import ArgoUI
import Foundation
import SwiftUI
import Testing

/// What a room switch costs, and what it is allowed to keep (#858).
///
/// `InstrumentDeckShell` draws each room in its own `switch` arm, so leaving the Sessions room
/// destroys the feed's table and coming back builds a new one. Every height it then asks for is a
/// full SwiftUI layout against the ruler, and there were ~300 of them per return over a transcript
/// of any length — 0.12–0.16 s of thread CPU a visit, release-built.
///
/// Counted in measurements and not in seconds, for `CostMeasure`'s reason: the count of layout
/// passes IS the cost, and a wall clock on a shared machine measures the machine. The cases below
/// the first two are the other half of the claim — every way a kept height could be a lie.
@Suite("Feed geometry across a switch")
@MainActor
struct FeedGeometryTests {
    /// Longer than the pane can hold several times over, so an entry costs what a real reading
    /// costs rather than a handful of visible rows.
    private static let rows = (0 ..< 400).map {
        FeedRow(id: $0, content: .message("A line of prose long enough to wrap, number \($0)."))
    }

    /// The same Session read another way — what the Agents rail's scope does. Same count, same
    /// indices, different rows.
    private static let scoped = rows.map {
        FeedRow(id: $0.id, content: .message("Another reading entirely, row \($0.id)."))
    }

    /// A reading with far less in it than `rows`, for the claim about what a switch stops holding.
    private static let short = Array(rows.prefix(10))

    private static let pane = CGSize(width: 460, height: 300)

    /// The gate. A reader who steps into the Tickets room and back has changed nothing about any
    /// row, so the return may not pay for a single layout — and before this it paid for all of
    /// them.
    @Test
    func `coming back to a room measures nothing again`() throws {
        let kept = Self.kept()
        let opened = try Self.entered(kept)
        #expect(opened.table.measurements > 0)

        let returned = try Self.entered(kept)

        #expect(returned.table.measurements == 0)
    }

    /// That what is kept is genuinely USED, not merely held: a table answering from an empty store
    /// would satisfy the count above by measuring nothing and drawing every row at the estimate.
    @Test
    func `the reading comes back at the height it was measured at`() throws {
        let kept = Self.kept()
        let opened = try Self.entered(kept)
        let stood = try #require(opened.table.table).frame.height

        let returned = try Self.entered(kept)

        let back = try #require(returned.table.table).frame.height
        let screens = NSScreen.screens.map { "\($0.frame.size) @\($0.backingScaleFactor)" }
        print(
            "CIPROBE stood=\(stood) back=\(back) firstMeasurements=\(opened.table.measurements) returnMeasurements=\(returned.table.measurements) keptCount=\(kept.geometry.count) rows=\(Self.rows.count) firstLayouts=\(String(describing: opened.table.table?.layouts)) backLayouts=\(String(describing: returned.table.table?.layouts)) firstDoc=\(opened.scroller.documentView?.frame.height ?? -1) backDoc=\(returned.scroller.documentView?.frame.height ?? -1) screens=\(screens)",
        )
        #expect(stood > 0)
        #expect(back == stood)
    }

    /// A height is a fact about a row's content AT A WIDTH. The reader who drags the sidebar while
    /// in another room comes back to a column of a different measure, and every height taken at the
    /// old one is wrong.
    @Test
    func `a width the reading was never measured at keeps nothing`() throws {
        let kept = Self.kept()
        _ = try Self.entered(kept)
        let wider = CGSize(width: Self.pane.width + 120, height: Self.pane.height)

        let returned = try Self.entered(kept, in: wider)

        #expect(returned.table.measurements > 0)
    }

    /// The other thing a height is a fact about — see `FeedCellEnvironment.reInks(against:)`. A
    /// type-size flip re-wraps every row.
    /// A pass fact rather than a row's: `FeedCellEnvironment.reInks(against:)` names the two that
    /// re-wrap every row, and a type-size flip retires the whole reading rather than one row of it.
    @Test
    func `a re-ink keeps nothing`() {
        let geometry = FeedGeometry()
        let model = FeedTableFixture.model(showing: Self.rows)
        geometry.settle(at: Self.pane.width, in: model.environment)
        geometry.record(120, at: 1, under: Self.ground(at: 1, of: model))
        var reinked = model
        reinked.environment.dynamicTypeSize = .accessibility3

        geometry.settle(at: Self.pane.width, in: reinked.environment)

        #expect(geometry.isEmpty)
    }

    /// The rows re-numbering under a table that is still standing: a row's id IS its index, so a
    /// reading with the same width and ink but DIFFERENT rows — the Agents rail scoping the feed
    /// onto a Subagent, or a transcript rewritten rather than appended to — must not come back at
    /// the heights of whatever stood at those indices.
    @Test
    func `a reading that re-numbers its rows keeps nothing`() throws {
        let kept = Self.kept()
        let opened = try Self.entered(kept)

        // Asked of the STORE, not through `apply` — a re-numbering that goes through the table is
        // caught by `execute`'s drop on a `.reload` delta, which would pass with no ground at all.
        // The claim here is that the ground alone refuses, which is the path a room switch takes.
        let scoped = FeedTableFixture.model(showing: Self.scoped)
        #expect(kept.geometry.height(at: 1, under: Self.ground(at: 1, of: scoped)) == nil)
        #expect(opened.table.measurements > 0)
    }

    /// The same claim across the switch: a reader who comes back to a reading that re-projected
    /// while they were away pays for it rather than drawing it at the old heights.
    @Test
    func `a reading that re-numbered while the reader was away is measured again`() throws {
        let kept = Self.kept()
        _ = try Self.entered(kept)

        let returned = try Self.entered(kept, showing: Self.scoped)

        #expect(returned.table.measurements > 0)
    }

    /// A live transcript rewrites its last row as the call in it is answered, and the reader is not
    /// watching while they are in another room. The row's own words are part of its ground, so the
    /// grown row is the one thing the return pays for.
    @Test
    func `a row rewritten while the reader was away is measured again`() throws {
        let kept = Self.kept()
        _ = try Self.entered(kept)
        var grown = Self.rows
        grown[grown.count - 1] = FeedRow(
            id: grown.count - 1,
            content: .message(String(repeating: "It grew while nobody watched. ", count: 40)),
        )

        let returned = try Self.entered(kept, showing: grown)

        #expect(returned.table.measurements > 0)
    }

    /// A prompt the reader unfolded is folded again by the switch — `FeedView.unfolded` is deck
    /// state and the deck is destroyed — so the row draws short. Its height goes with it, or the
    /// reading comes back with a folded prompt standing in an unfolded row's space.
    @Test
    func `a fold is part of what a height is true of`() {
        let geometry = FeedGeometry()
        let folded = FeedTableFixture.model(showing: Self.rows)
        geometry.record(900, at: 1, under: Self.ground(at: 1, of: folded))
        var unfolded = folded
        unfolded.unfolded = .constant([Self.rows[1].id])

        #expect(geometry.height(at: 1, under: Self.ground(at: 1, of: unfolded)) == nil)
    }

    /// A survey draws one line per call while it is the open row and nothing while it is not
    /// (`FeedSurveyLine`), and opening one does not change the pane's width — so no re-measure is
    /// ordered and `touchUp` refreshes the cell WITHOUT re-noting its height. A store that kept the
    /// collapsed height would answer with it, and the run's list would be drawn clipped.
    @Test
    func `whether a row is open is part of what a height is true of`() {
        let geometry = FeedGeometry()
        let shut = FeedTableFixture.model(showing: Self.rows)
        geometry.record(30, at: 1, under: Self.ground(at: 1, of: shut))
        var open = shut
        open.selection = FeedRowSelection(
            open: .constant(Self.rows[1].id), step: .constant(nil), lit: .constant(nil),
            focus: shut.selection.focus,
        )

        #expect(geometry.height(at: 1, under: Self.ground(at: 1, of: open)) == nil)
    }

    /// The step above a row is INSIDE that row's height — `FeedRow.step(to:from:)` — so the row
    /// above is part of the ground even when the row itself has not moved.
    @Test
    func `the row above is part of what a height is true of`() {
        let geometry = FeedGeometry()
        let model = FeedTableFixture.model(showing: Self.rows)
        geometry.record(120, at: 1, under: Self.ground(at: 1, of: model))
        var moved = Self.rows
        moved[0] = FeedRow(id: 0, content: .message("The row above is another row now."))

        let after = FeedTableFixture.model(showing: moved)
        #expect(geometry.height(at: 1, under: Self.ground(at: 1, of: after)) == nil)
    }

    /// Nothing is remembered longer than the reading on screen, which is the whole bound on what
    /// this costs in memory. A long reading, then a short one: the entries the short one cannot
    /// name are gone, or a Session with ten rows would hold the previous one's four hundred for the
    /// life of the window. Asserting against the LONG reading's count would pass on any
    /// implementation, bound or not, because its keys are 0 ..< 400 by construction.
    @Test
    func `a shorter reading does not go on holding the longer one's heights`() throws {
        let kept = Self.kept()
        _ = try Self.entered(kept)
        #expect(kept.geometry.count > Self.short.count)

        _ = try Self.entered(kept, showing: Self.short)

        #expect(kept.geometry.count <= Self.short.count)
    }

    private static func ground(at index: Int, of model: FeedTableModel) -> FeedGeometry.Ground {
        FeedGeometry.Ground(at: index, of: model)
    }

    private static func kept(sharing geometry: FeedGeometry = FeedGeometry())
        -> FeedTableFixture.Kept {
        FeedTableFixture.Kept(handle: FeedTableHandle(), geometry: geometry)
    }

    /// One entry into the Sessions room. The scroller comes back with the coordinator because the
    /// coordinator holds it WEAKLY — SwiftUI owns the view in the running app, and a case that let
    /// it go would be asserting over a table that no longer exists.
    private static func entered(
        _ kept: FeedTableFixture.Kept,
        in pane: CGSize = pane,
        showing rows: [FeedRow] = rows,
    ) throws
        -> Entered {
        let table = FeedTableFixture.laidOut(rows, in: pane, keeping: kept)
        return try Entered(scroller: #require(table.scroller), table: table)
    }

    private struct Entered {
        let scroller: NSScrollView
        let table: FeedTableCoordinator
    }
}
