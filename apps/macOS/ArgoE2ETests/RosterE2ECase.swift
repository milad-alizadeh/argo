import XCTest

/// The launch every roster case shares, and the ways all of them address a row.
///
/// One class rather than a copy per suite, for the reason `FeedE2ECase` is one: these cases differ
/// in which named state the app opens on, and how a roster row is addressed is not per-suite
/// knowledge.
///
/// `@MainActor` because driving a UI is main-actor work under Swift 6.
@MainActor
class RosterE2ECase: XCTestCase {
    /// Which named state the app opens on. Every case answers it and the base answers it for none
    /// of them — a default here would be one suite's reading standing in for another's.
    var specimen: String {
        preconditionFailure("A roster case must name the specimen it opens on.")
    }

    let app = XCUIApplication()

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        app.launchArguments += ["--specimen", specimen]
        app.launch()
        XCTAssertTrue(
            app.wait(for: .runningForeground, timeout: 30),
            "Argo did not reach the foreground.",
        )
    }

    override func tearDown() async throws {
        app.terminate()
        try await super.tearDown()
    }

    /// A row, by the announcement the projection gives it — which opens with the title.
    func row(titled title: String) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH %@", title))
            .firstMatch
    }

    /// The list cell AROUND that row, which is where selection is reported: the element the row's
    /// announcement labels is the content inside it, and content does not know it was picked.
    func cell(titled title: String) -> XCUIElement {
        app.cells
            .containing(NSPredicate(format: "label BEGINSWITH %@", title))
            .firstMatch
    }

    /// Where the title is drawn inside a row — the leading part of its upper line.
    ///
    /// Geometric because the row is deliberately ONE accessibility element: the projection decides
    /// what a row announces, so the title is not separately addressable, and a click meant for the
    /// title has nowhere else to be aimed.
    func titleArea(of row: XCUIElement) -> XCUICoordinate {
        row.coordinate(withNormalizedOffset: CGVector(dx: 0.3, dy: 0.35))
    }

    /// Waits on a change of STATE on an element that already exists, which no existence
    /// expectation can ask about.
    func expect(_ predicate: String, of element: XCUIElement, timeout: TimeInterval = 10) -> Bool {
        let met = expectation(for: NSPredicate(format: predicate), evaluatedWith: element)
        return XCTWaiter().wait(for: [met], timeout: timeout) == .completed
    }
}
