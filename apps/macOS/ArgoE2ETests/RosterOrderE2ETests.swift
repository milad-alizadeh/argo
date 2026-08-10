import XCTest

/// The roster's order in front of a reader, driven the way a person drives it.
///
/// This is the only kind of test that can make the claim at all. A package test can assert what
/// `RosterOrder` publishes given a sequence of orders, and `RosterOrderTests` does — but the thing
/// that broke was rows trading places over SECONDS in a window somebody was looking at, and no
/// projection test or still render carries a window or a second in which to move one.
///
/// Nothing here hovers the roster, deliberately. The first version of this test held the pointer in
/// the list for its whole length, which is what let the freeze ship holding on the pointer alone: a
/// roster nobody had touched yet held nothing, and reshuffled from launch.
@MainActor
final class RosterOrderE2ETests: RosterE2ECase {
    /// The two Sessions `ChurningRosterSpecimen` leapfrogs. Addressed by the titles the roster
    /// already draws, so the test needs no identifier invented for its benefit.
    private static let leapfroggers = (
        first: "Ship the native Liquid Glass application shell",
        second: "Port the session engine core to Swift",
    )

    override var specimen: String {
        "churningRoster"
    }

    /// ONE test walking the whole thing, because each case here costs a launch and the walk is
    /// the claim: hold from launch, keep admitting members while held, re-settle out of sight.
    func testTheRosterHoldsItsOrderWhileTheWindowIsUpAndReSettlesBehindIt() async throws {
        let first = row(titled: Self.leapfroggers.first)
        let second = row(titled: Self.leapfroggers.second)
        XCTAssertTrue(first.waitForExistence(timeout: 20), "The sidebar drew no roster.")
        XCTAssertTrue(second.exists, "The roster is missing the second Session that churns.")

        // Read straight off the launch, with nothing touched: the order a reader is first shown is
        // the one they are entitled to keep.
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
                "Two Sessions traded places in a window somebody was looking at.",
            )
            sawArrival = sawArrival || arrival.exists
            sawDeparture = sawDeparture || !arrival.exists
        }

        // Without these the test passes against a specimen that stopped churning, and against a
        // freeze that stopped admitting members — which is the failure "hold the order" invites.
        XCTAssertTrue(sawArrival, "No Session arrived while the order was held.")
        XCTAssertTrue(sawDeparture, "No Session left while the order was held.")

        // Behind another app, where nothing is being read, and the order goes back to answering
        // what moved last — so it is already right when the reader comes back rather than
        // re-settling in front of them.
        //
        // Several trips rather than one, because the freeze takes hold again the moment the window
        // is front: what comes back is a SAMPLE of the churn, and one sample can land on the order
        // that was already there without saying anything about whether it moved.
        var reSettled = false
        for _ in 0 ..< 8 where !reSettled {
            XCUIApplication(bundleIdentifier: "com.apple.finder").activate()
            try await Task.sleep(for: .seconds(2))
            app.activate()
            XCTAssertTrue(
                app.wait(for: .runningForeground, timeout: 20),
                "Argo did not come back to the foreground.",
            )
            reSettled = relation(first, second) != held
        }
        XCTAssertTrue(
            reSettled,
            "The order never re-settled while the window was behind another app.",
        )
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
}
