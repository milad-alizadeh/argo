import XCTest

/// The roster's order in front of a reader. The failure is rows trading places over SECONDS in a
/// live window, which no projection test or still render carries the time to show.
///
/// Nothing here hovers the roster, deliberately: a pointer held in the list would pass against a
/// freeze that holds on hover alone and reshuffles from launch.
@MainActor
final class RosterOrderE2ETests: RosterE2ECase {
    /// The two Sessions `ChurningRosterSpecimen` leapfrogs, addressed by the titles the roster
    /// draws.
    private static let leapfroggers = (
        first: "Ship the native Liquid Glass application shell",
        second: "Port the session engine core to Swift",
    )

    override var specimen: String {
        "churningRoster"
    }

    /// ONE test walking the whole thing — each case here costs a launch: hold from launch, keep
    /// admitting members while held, re-settle out of sight.
    func testTheRosterHoldsItsOrderWhileTheWindowIsUpAndReSettlesBehindIt() async throws {
        let first = row(titled: Self.leapfroggers.first)
        let second = row(titled: Self.leapfroggers.second)
        XCTAssertTrue(first.waitForExistence(timeout: 20), "The sidebar drew no roster.")
        XCTAssertTrue(second.exists, "The roster is missing the second Session that churns.")

        // Read straight off the launch, with nothing touched.
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

        // Behind another app, the order goes back to answering what moved last. Several trips: the
        // freeze retakes the moment the window is front, so one sample can land on the same order.
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

    /// Which of the two is above the other, or `nil` while neither can be placed. Relative, not
    /// each
    /// row's own y: a held order still admits Sessions, so a row moving DOWN is the freeze working.
    private func relation(_ first: XCUIElement, _ second: XCUIElement) -> Bool? {
        guard first.exists, second.exists else { return nil }
        return first.frame.origin.y < second.frame.origin.y
    }

    private var arrival: XCUIElement {
        row(titled: "Start a Session while the roster is being read")
    }
}
