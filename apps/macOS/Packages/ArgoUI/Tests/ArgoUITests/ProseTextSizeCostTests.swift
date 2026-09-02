import AppKit
@testable import ArgoUI
import ProseText
import Testing

/// What #1027's freshness check costs the feed's hot measurement path, and what the alternative it
/// was chosen over would have cost (ADR-0028 Rules 3, 7 and 8).
///
/// Both cases are CPU quotients, which Rule 8 admits only where the halves are the same KIND of
/// work. They are: every arm here is a tight loop of small main-actor static reads over the same
/// warm dictionary entry, no allocation and no memory profile to speak of, so the factors a busy
/// box inflates them by cancel. Each block is repeated until it is milliseconds rather than the
/// clock's own floor, and the arms are INTERLEAVED — measured in blocks, a box drifting under the
/// rest of the suite is compared as well as the work is (#998).
@MainActor
@Suite("Prose text size cost", .serialized)
struct ProseTextSizeCostTests {
    /// Its own words, so the ask below is a hit off this suite's own entry and not a hit that
    /// depends on which suite ran first.
    private static let text = "cost of a size answered finished looked across a measure"

    /// A warm ask is a few hundred nanoseconds, so the block is a hundred thousand of them.
    private static let passes = 100_000

    /// Fewer, because the arm it sizes pays an `NSFont.preferredFont` read a pass at microseconds
    /// each. Both arms are still milliseconds.
    private static let keyedPasses = 20000

    /// The gate on the poll. The check is a clock read the ask can afford; a check that went back
    /// to asking the platform every time would read multiples of the ask rather than a fraction.
    @Test
    func `the freshness check is a small share of the warm ask it guards`() {
        _ = ProseMetrics.width(of: Self.text)

        let pairs = pairedCPUSeconds(
            trials: 9,
        ) {
            for _ in 0 ..< Self.passes {
                _ = ProseMetrics.width(of: Self.text)
            }
        }
        against: {
            for _ in 0 ..< Self.passes {
                _ = ProseTextSize.epoch()
            }
        }
        let ask = pairs.map(\.first).min() ?? 0
        let check = pairs.map(\.second).min() ?? 0
        let share = check / ask

        #expect(
            share < PerfBudgets.textSizeCheckShare,
            "ask \(ask)s check \(check)s share \(share)",
        )
    }

    /// The design this was chosen over: the resolved size in every cache key, which is one
    /// `NSFont.preferredFont` read per key construction. The same arm both sides — the same warm
    /// ask over the same entry, one freshness read each — so the only difference between the halves
    /// is WHICH read, which is what makes the quotient a fact about the two designs.
    @Test
    func `keying every entry on the resolved size would cost multiples of the ask`() {
        _ = ProseMetrics.width(of: Self.text)

        let pairs = pairedCPUSeconds(
            trials: 9,
        ) {
            for _ in 0 ..< Self.keyedPasses {
                _ = ProseMetrics.width(of: Self.text)
            }
        }
        against: {
            for _ in 0 ..< Self.keyedPasses {
                _ = NSFont.preferredFont(forTextStyle: .body).pointSize
                _ = ProseMetrics.width(of: Self.text)
            }
        }
        let shipped = pairs.map(\.first).min() ?? 0
        let keyed = pairs.map(\.second).min() ?? 0
        let fold = keyed / shipped

        #expect(
            fold > PerfBudgets.keyedTextSizeFold,
            "shipped \(shipped)s keyed \(keyed)s fold \(fold)",
        )
    }
}
