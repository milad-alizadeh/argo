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
/// driven. The two agree by construction: same specimen, same widths, same intervals, same
/// nearest-rank percentiles.
@MainActor
final class FeedFrameE2ETests: FeedE2ECase {
    override var specimen: String {
        "feedAtScale"
    }

    /// The 60fps floor in milliseconds. A frame longer than this missed a refresh.
    private static let floor = 1000.0 / 60

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
    /// The first walk is thrown away deliberately. A launch is the slowest thing this app does —
    /// caches cold, the window just laid out — and a measurement that starts on the first frame
    /// measures that instead of the drag. Without the warm-up the same run disagreed with itself by
    /// a factor of twenty.
    ///
    /// The gate is stated on the TAIL rather than on the single worst frame: one hitch as a gesture
    /// reverses is a hitch, and a p95 above the floor is a reading that stutters all the way down.
    func testASustainedDragHoldsTheFrameFloor() {
        XCTAssertTrue(feed.waitForExistence(timeout: 20), "The deck drew no feed.")

        walk(by: 600, times: 20)
        let warmed = intervals()

        walk(by: -600, times: 40)
        walk(by: 600, times: 40)
        app.terminate()

        let drag = Array(intervals().dropFirst(warmed.count))
        XCTAssertGreaterThan(drag.count, 100, "The drag produced too few frames to say anything.")

        let sorted = drag.sorted()
        let p95 = sorted[min(Int((0.95 * Double(sorted.count)).rounded(.up)) - 1, sorted.count - 1)]
        let dropped = sorted.filter { $0 > Self.floor }.count

        XCTAssertLessThanOrEqual(p95, Self.floor, "p95 frame interval was \(p95)ms.")
        XCTAssertLessThan(
            Double(dropped) / Double(sorted.count),
            0.02,
            "\(dropped) of \(sorted.count) frames ran past the 60fps floor.",
        )
    }

    /// Every interval the app has written so far, in the order it wrote them.
    private func intervals() -> [Double] {
        guard let text = try? String(contentsOfFile: log, encoding: .utf8) else { return [] }
        return text.split(separator: "\n").compactMap { Double($0) }
    }
}
