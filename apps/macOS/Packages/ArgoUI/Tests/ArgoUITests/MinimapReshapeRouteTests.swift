import AppKit
@testable import ArgoSpecimens
@testable import ArgoUI
import Foundation
import Testing

/// HOW the lane hears that the reading reshaped, as distinct from what it does about it.
///
/// `MinimapReshapeTests` holds the decision — one derivation for a burst, none for a report
/// carrying no reshape. This suite holds the registration, which #955 left alone and #971 moved:
/// the two decisions are still two, and a `NotificationCenter` observer is registered for them
/// once rather than twice. ADR-0028's edge 8 walks the call graph out of every
/// `addObserver(_:selector:name:object:)` selector, so a second selector graph is a cost the gate
/// pays and this is what keeps it at one.
///
/// Counts rather than seconds, because a registration is countable exactly (ADR-0028 Rule 8).
@Suite("Minimap reshape route")
@MainActor
struct MinimapReshapeRouteTests {
    /// The gate: one frame observer for the pair of frame decisions the deck makes.
    ///
    /// Read out of the sources the way `AccentAssetTests` reads the asset catalogue — a
    /// registration cannot be counted at runtime, and a claim nobody can check is the thing this
    /// issue was about. The lane's own half is checked as behaviour below, which is the stronger
    /// end of the same claim.
    @Test
    func `one frame observer is registered for the pane and the reading both`() throws {
        let registered = try Self.frameRegistrations()

        #expect(registered.count == 1)
        #expect(registered.first == "FeedTableCoordinator+Scrolling.swift")
    }

    /// The lane's half, at runtime: a document frame notification reaches nothing, because the lane
    /// no longer asked for one. This fails if the observer comes back.
    @Test
    func `the lane hears no document frame notification of its own`() async throws {
        let deck = await MinimapLaneFixture.mounted(over: FeedProjection.longRows)
        deck.lane.layoutSubtreeIfNeeded()
        let noticed = deck.lane.reshapeNotices
        let document = try #require(deck.table.scroller?.documentView)

        FeedTableFixture.postFrameChange(on: document)

        #expect(deck.lane.reshapeNotices == noticed)
    }

    /// And the reshape still lands — end to end over the route that replaced it, with nothing in
    /// the case reporting anything by hand: the rows grow, AppKit resizes the reading, and the lane
    /// maps the document it now has.
    @Test
    func `a reading that grows reshapes the lane over the handle`() async {
        let deck = await MinimapLaneFixture
            .mounted(over: Array(FeedProjection.longRows.dropLast(20)))
        deck.lane.layoutSubtreeIfNeeded()
        let mapped = deck.lane.geometry.documentHeight
        let noticed = deck.lane.reshapeNotices

        deck.table.apply(FeedTableFixture.model(showing: FeedProjection.longRows))
        await FeedTableFixture.settled(deck.table)
        deck.table.scroller?.layoutSubtreeIfNeeded()
        deck.lane.layoutSubtreeIfNeeded()

        #expect(deck.lane.reshapeNotices > noticed)
        #expect(deck.lane.geometry.documentHeight > mapped)
    }

    /// Every file in `ArgoUI` that registers an observer of a view's frame, by name.
    private static func frameRegistrations() throws -> [String] {
        let files = FileManager.default.enumerator(
            at: Self.sources,
            includingPropertiesForKeys: nil,
        )
        let sources = try #require(files)
        var registered: [String] = []
        for case let file as URL in sources where file.pathExtension == "swift" {
            let lines = try String(contentsOf: file, encoding: .utf8).split(separator: "\n")
            // The argument as SwiftFormat writes it, so a mention of the name in prose is not a
            // registration and a registration cannot be spelled around this.
            let found = lines.filter { $0.contains("name: NSView.frameDidChangeNotification") }
            registered.append(contentsOf: found.map { _ in file.lastPathComponent })
        }
        return registered.sorted()
    }

    /// `#filePath` walks to the package's sources, three levels up from this suite:
    /// `Packages/ArgoUI/Tests/ArgoUITests`.
    private static var sources: URL {
        var root = URL(filePath: #filePath)
        for _ in 0 ..< 3 {
            root.deleteLastPathComponent()
        }
        return root.appending(path: "Sources")
    }
}
