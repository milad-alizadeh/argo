import XCTest

/// The 60fps floor, driven and asserted rather than watched.
///
/// Every other case in this target asserts a structure — a row is reachable, an end still holds.
/// This one asserts a NUMBER, and it can only exist here: the frame meter runs inside the app, and
/// the only thing in this repo that can launch the app, hold a sustained drag on it and then read
/// what it wrote is an XCUITest.
///
/// The reading is taken from the file the app kept, not from anything on screen. `--feed-fps-log`
/// turns the meter on and names that file (`FrameFlag`), and terminating the app is what flushes
/// the last batch of it — which is why the drag is over before a single line is read.
///
/// `sh scripts/feed-fps.sh` measures the same thing without XCUITest, for a machine that cannot be
/// driven: same specimen, same intervals, same nearest-rank percentiles, same floor.
@MainActor
final class FeedFrameE2ETests: FeedE2ECase {
    override var specimen: String {
        "feedAtScale"
    }

    /// The 60fps floor in milliseconds. A frame longer than this missed a refresh.
    private static let floor = 1000.0 / 60

    /// How many samples the app can be holding when the log is read mid-run — `FrameRecorder`
    /// writes in batches, so this many warm-up frames may not have landed yet.
    private static let batch = 30

    private let log = NSTemporaryDirectory() + "argo-feed-frames-\(UUID().uuidString)"

    override func setUp() async throws {
        app.launchArguments += ["--feed-fps-log", log]
        try await super.setUp()
    }

    override func tearDown() async throws {
        try? FileManager.default.removeItem(atPath: log)
        try await super.tearDown()
    }

    /// A sustained drag through a real session's worth of rows, and what the frames say about it.
    ///
    /// The first pass is thrown away deliberately. A launch is the slowest thing this app does —
    /// caches cold, the window just laid out — and a measurement that starts on the first frame
    /// measures that instead of the drag: without a warm-up the same run disagreed with itself by
    /// a factor of twenty.
    ///
    /// The gate is stated on the TAIL rather than on the single worst frame. One hitch as a gesture
    /// turns around is a hitch; a p95 above the floor is a reading that stutters all the way down.
    func testASustainedDragHoldsTheFrameFloor() {
        XCTAssertTrue(feed.waitForExistence(timeout: 20), "The deck drew no feed.")

        walk(by: 600, times: 20)
        let warmed = intervals().count

        drag(by: -560, times: 6)
        drag(by: 560, times: 6)
        app.terminate()

        // A batch further than the warm-up reached, because that read could not see what the app
        // had not yet written. Over-dropping costs frames from the front of the drag;
        // under-dropping puts the launch inside the measurement, which is the error worth avoiding.
        let drag = Array(intervals().dropFirst(warmed + Self.batch))
        XCTAssertGreaterThan(
            drag.count,
            100,
            "Too few frames to say anything — is \(log) being written?",
        )

        let sorted = drag.sorted()
        let p95 = sorted[min(Int((0.95 * Double(sorted.count)).rounded(.up)) - 1, sorted.count - 1)]
        let dropped = sorted.filter { $0 > Self.floor }.count

        XCTAssertLessThanOrEqual(p95, Self.floor, "p95 frame interval was \(p95)ms.")
        XCTAssertLessThan(
            Double(dropped) / Double(sorted.count),
            0.01,
            "\(dropped) of \(sorted.count) frames ran past the 60fps floor.",
        )
    }

    /// A held, continuous DRAG rather than `walk`'s wheel.
    ///
    /// The two are different inputs to the same scroll view, and only one of them is what the
    /// reader is complaining about: a wheel tick is discrete and raises no gesture, so it never
    /// puts the scroll view into an interactive scroll. `ScrollDriver.swift` makes the same
    /// distinction for the same reason.
    private func drag(by delta: CGFloat, times: Int) {
        let column = feed
        for _ in 0 ..< times {
            let from = column.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
            from.press(
                forDuration: 0.1,
                thenDragTo: from.withOffset(CGVector(dx: 0, dy: delta)),
                withVelocity: .default,
                thenHoldForDuration: 0.1,
            )
        }
    }

    /// Every interval the app has written so far, in the order it wrote them.
    private func intervals() -> [Double] {
        guard let text = try? String(contentsOfFile: log, encoding: .utf8) else { return [] }
        return text.split(separator: "\n").compactMap { Double($0) }
    }
}
