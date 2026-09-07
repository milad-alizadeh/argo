@testable import ArgoUI
import Foundation
import Testing

/// The wall clock a colliding derived title takes (#1567). Read in a FIXED zone: the phrase is
/// the machine's own calendar in production, and a suite asserting the machine's zone would be
/// asserting the machine.
@Suite("Time of day")
struct TimeOfDayPhraseTests {
    private var utc: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .gmt
        return calendar
    }

    @Test
    func `a moment reads as a padded 24-hour clock`() {
        let afternoon = ((14 * 60 + 32) * 60 + 7) * 1000

        #expect(TimeOfDayPhrase.phrase(atMs: afternoon, calendar: utc) == "14:32:07")
    }

    @Test
    func `midnight pads every field`() {
        #expect(TimeOfDayPhrase.phrase(atMs: 0, calendar: utc) == "00:00:00")
    }

    /// Two runs a `-p` loop opened inside the same minute still read apart, which is the whole
    /// point of spending the seconds.
    @Test
    func `two moments in one minute read apart`() {
        let first = TimeOfDayPhrase.phrase(atMs: 61000, calendar: utc)

        #expect(first != TimeOfDayPhrase.phrase(atMs: 62000, calendar: utc))
    }

    @Test
    func `a moment nothing recorded spends no clock`() {
        #expect(TimeOfDayPhrase.phrase(atMs: nil, calendar: utc) == nil)
    }
}
