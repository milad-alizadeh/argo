import XCTest

/// The roster's order under a reader, driven the way a person drives it.
///
/// This is the only kind of test that can make the claim at all. A package test can assert what
/// `RosterOrder` publishes given a sequence of orders, and `RosterOrderTests` does — but the thing
/// that broke was rows trading places under a POINTER, and neither a projection test nor a still
/// render carries a pointer or a second in which to move one.
@MainActor
final class RosterOrderE2ETests: XCTestCase {
    /// The two Sessions `ChurningRosterSpecimen` leapfrogs. Addressed by the titles the roster
    /// already draws, so the test needs no identifier invented for its benefit.
    private static let leapfroggers = (
        first: "Ship the native Liquid Glass application shell",
        second: "Port the session engine core to Swift",
    )

    private let app = XCUIApplication()

    override func setUp() async throws {
        try await super.setUp()
        continueAfterFailure = false
        app.launchArguments += ["--specimen", "churningRoster"]
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

    /// ONE test walking the whole thing, because each case here costs a launch and the walk is
    /// the claim: hold under the reader, keep admitting members while held, re-settle after.
    func testTheRosterHoldsItsOrderUnderTheReaderAndReSettlesAfterwards() async throws {
        let first = row(titled: Self.leapfroggers.first)
        let second = row(titled: Self.leapfroggers.second)
        XCTAssertTrue(first.waitForExistence(timeout: 20), "The sidebar drew no roster.")
        XCTAssertTrue(second.exists, "The roster is missing the second Session that churns.")

        // The pointer goes into the list and stays there. Everything below reads frames, which
        // moves nothing — so the hover under test is held for the whole of it.
        first.hover()
        let held = try XCTUnwrap(relation(first, second), "Neither row was on screen to compare.")

        // Several beats of the specimen's churn — long enough to cross a full arrive-and-end
        // cycle, so the two vacuity guards below have something to have seen.
        var sawArrival = false
        var sawDeparture = false
        for _ in 0 ..< 40 {
            try await Task.sleep(for: .milliseconds(400))
            XCTAssertEqual(
                relation(first, second),
                held,
                "Two Sessions traded places while the pointer was in the roster.",
            )
            sawArrival = sawArrival || arrival.exists
            sawDeparture = sawDeparture || !arrival.exists
        }

        // Without these the test passes against a specimen that stopped churning, and against a
        // freeze that stopped admitting members — which is the failure "hold the order" invites.
        XCTAssertTrue(sawArrival, "No Session arrived while the order was held.")
        XCTAssertTrue(sawDeparture, "No Session left while the order was held.")

        // Out of the list, and the order goes back to answering what moved last.
        app.windows.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.8, dy: 0.5)).hover()
        var reSettled = false
        for _ in 0 ..< 40 where !reSettled {
            try await Task.sleep(for: .milliseconds(400))
            reSettled = relation(first, second) != held
        }
        XCTAssertTrue(reSettled, "The order never re-settled after the reader left the roster.")
        XCTAssertEqual(app.state, .runningForeground)
    }

    /// Which of the two is above the other, or `nil` while neither can be placed. Compared rather
    /// than each row's own y, because a held order still lets Sessions in and out — a row moving
    /// DOWN because one arrived above it is the freeze working, not failing.
    private func relation(_ first: XCUIElement, _ second: XCUIElement) -> Bool? {
        guard first.exists, second.exists else { return nil }
        return first.frame.origin.y < second.frame.origin.y
    }

    private var arrival: XCUIElement {
        row(titled: "Start a Session while the roster is being read")
    }

    private func row(titled title: String) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH %@", title))
            .firstMatch
    }
}
