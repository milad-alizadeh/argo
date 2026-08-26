import XCTest

/// The launch every roster case shares, and the ways all of them address a row.
///
/// `@MainActor` because driving a UI is main-actor work under Swift 6.
@MainActor
class RosterE2ECase: XCTestCase {
    /// Which named state the app opens on. Every case answers it; the base deliberately does not.
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

    func row(titled title: String) -> XCUIElement {
        app.rosterRow(titled: title)
    }

    /// The list cell AROUND that row, which is where selection is reported: the element the row's
    /// announcement labels is the content inside it, and content does not know it was picked.
    func cell(titled title: String) -> XCUIElement {
        app.cells
            .containing(NSPredicate(format: "label BEGINSWITH %@", title))
            .firstMatch
    }

    /// Where the title is drawn inside a row — the leading part of its upper line. Geometric
    /// because the row is deliberately ONE accessibility element, so the title is not separately
    /// addressable.
    func titleArea(of row: XCUIElement) -> XCUICoordinate {
        row.coordinate(withNormalizedOffset: CGVector(dx: 0.3, dy: 0.35))
    }

    /// Where a row's own label is drawn, past any mark in its leading gutter. Geometric for the
    /// reason `titleArea(of:)` is.
    func labelArea(of row: XCUIElement) -> XCUICoordinate {
        row.coordinate(withNormalizedOffset: CGVector(dx: 0.6, dy: 0.5))
    }

    /// Waits on a change of STATE on an element that already exists, which no existence
    /// expectation can ask about.
    func expect(_ predicate: String, of element: XCUIElement, timeout: TimeInterval = 10) -> Bool {
        let met = expectation(for: NSPredicate(format: predicate), evaluatedWith: element)
        return XCTWaiter().wait(for: [met], timeout: timeout) == .completed
    }
}
