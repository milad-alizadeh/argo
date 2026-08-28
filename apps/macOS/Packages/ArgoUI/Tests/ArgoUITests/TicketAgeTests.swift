@testable import ArgoUI
import Foundation
import Testing

/// How long ago a ticket was last touched, as a backlog row stamps it (#897).
///
/// One rounded unit and never a timestamp: the reason to look is DISTANCE FROM NOW, and a row
/// scanned at a glance cannot afford a date a reader has to subtract from today.
@Suite("The backlog row's age stamp")
struct TicketAgeTests {
    private static let now = Date(timeIntervalSince1970: 1_700_000_000)

    private static func stamp(daysAgo: Double) -> String {
        TicketAge.stamp(since: now.addingTimeInterval(-daysAgo * 86400), asOf: now)
    }

    struct StampCase: Sendable {
        let daysAgo: Double
        let stamp: String
    }

    /// Every boundary, both sides, so the ramp cannot slip a unit without a failure. The last rung
    /// is years: a ticket old enough to want an absolute date is one nobody is scanning the list
    /// for, and a second spelling would cost the column its rhythm.
    private static let stamps = [
        StampCase(daysAgo: 0, stamp: "now"),
        StampCase(daysAgo: 1 / 24.0, stamp: "1h"),
        StampCase(daysAgo: 23 / 24.0, stamp: "23h"),
        StampCase(daysAgo: 1, stamp: "1d"),
        StampCase(daysAgo: 6, stamp: "6d"),
        StampCase(daysAgo: 7, stamp: "1w"),
        StampCase(daysAgo: 29, stamp: "4w"),
        StampCase(daysAgo: 30, stamp: "1mo"),
        StampCase(daysAgo: 364, stamp: "12mo"),
        StampCase(daysAgo: 365, stamp: "1y"),
        StampCase(daysAgo: 900, stamp: "2y"),
    ]

    @Test(arguments: stamps)
    func `an age reads as one rounded unit`(each: StampCase) {
        #expect(Self.stamp(daysAgo: each.daysAgo) == each.stamp)
    }

    /// A provider's clock ahead of this machine's is two machines disagreeing about seconds, not a
    /// ticket touched in the future — the same floor `AgePhrase` keeps.
    @Test
    func `a date in the future floors at now`() {
        #expect(Self.stamp(daysAgo: -3) == "now")
    }
}
