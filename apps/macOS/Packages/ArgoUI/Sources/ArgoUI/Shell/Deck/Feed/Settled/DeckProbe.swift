import Foundation
import os

/// Temporary profiling instrument for #1132: is the minimap desync/jitter on long sessions caused
/// by the deep `[FeedRow]` equality checks on the settle/minimap hot path costing O(rows) (or
/// worse) time on every reshape, starving the main thread long enough to delay
/// `MinimapLaneView.waitForSettle()`'s re-arm?
///
/// Additive and meant to be deleted once #1132 is resolved one way or the other — it is not a
/// permanent counter like `FeedPaneCost` (ADR-0028 Rule 7), it is a stopwatch. `time`/`mark` are
/// no-ops outside DEBUG so call sites need no `#if` of their own.
///
/// Points of Interest show up in Instruments under this log's subsystem/category, and every call
/// slower than `logThreshold` is also printed to Console so the same signal can be read without
/// opening Instruments at all.
enum DeckProbe {
    #if DEBUG
        static let signposter = OSSignposter(
            logger: Logger(subsystem: "com.argo.deck.measure", category: "DeckProbe"),
        )

        /// Rows below this size are not worth the printf: only the walks that could plausibly
        /// explain user-visible jitter are logged, not the ones a short session takes.
        static let logThreshold: TimeInterval = 0.002
    #endif

    /// Times `body`, points-of-interest it in Instruments as `name`, and prints it to Console
    /// when it took longer than `logThreshold`. A passthrough outside DEBUG.
    static func time<T>(_ name: StaticString, rows: Int, _ body: () -> T) -> T {
        #if DEBUG
            let state = signposter.beginInterval(name)
            let start = DispatchTime.now()
            let result = body()
            let nanos = DispatchTime.now().uptimeNanoseconds - start.uptimeNanoseconds
            let elapsed = Double(nanos) / 1e9
            signposter.endInterval(name, state)
            if elapsed >= logThreshold {
                print(
                    "[DeckProbe] \(name) rows=\(rows) elapsed=\(String(format: "%.4f", elapsed))s",
                )
            }
            return result
        #else
            return body()
        #endif
    }

    /// A bare mark, for events that are instants rather than intervals — e.g. `waitForSettle`
    /// arming and firing, to measure the gap between them under load. A no-op outside DEBUG.
    static func mark(_ name: StaticString, _ message: String = "") {
        #if DEBUG
            signposter.emitEvent(name, "\(message)")
            print("[DeckProbe] \(name) \(message) t=\(DispatchTime.now().uptimeNanoseconds)")
        #endif
    }
}
