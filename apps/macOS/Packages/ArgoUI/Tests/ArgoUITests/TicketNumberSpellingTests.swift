@testable import ArgoUI
import SwiftUI
import Testing

/// A Ticket's number is an IDENTIFIER, not a quantity: `#1261`, in every locale (#1263).
///
/// The tests resolve a real `Text` under a locale that groups digits, because that is where the
/// fault was — nothing about the number itself was ever wrong, only what SwiftUI did with it on
/// the way to the screen. `en_US` groups on three digits, so a four-digit number is the shortest
/// one that can fail; the three-digit ticket every surface was written against could not, which is
/// why this stood until the repo passed issue 1000.
///
/// `_resolveText(in:)` is SwiftUI's own underscored SPI, and the only way to ask a `Text` what it
/// says. It is the one thing here that an SDK bump could take away — LOUDLY, as a compile failure
/// in this file, which is the signal to find the replacement rather than to delete the suite.
@Suite("Ticket number spelling")
@MainActor
struct TicketNumberSpellingTests {
    /// The locale the drawn text is resolved in. A test that resolved in the machine's own locale
    /// would pass on a machine that groups nothing and prove nothing anywhere. Computed rather
    /// than stored: `EnvironmentValues` is not `Sendable`, so it cannot be a shared global.
    private static var grouping: EnvironmentValues {
        var values = EnvironmentValues()
        values.locale = Locale(identifier: "en_US")
        return values
    }

    /// The fault itself, kept as a test rather than as prose. It is the reason `IssueReading.mark`
    /// exists, and a Swift release that stopped formatting an interpolated `Int` would fail here
    /// first — which is the signal to delete the helper, not to loosen the tests below.
    @Test
    func `handing SwiftUI the number as a localized key is what groups the digits`() {
        #expect(Text("#\(1261)")._resolveText(in: Self.grouping) == "#1,261")
    }

    /// The other half of the sweep. A count is a QUANTITY rather than an identifier, so it keeps
    /// the locale — and loses only the separator, through the one style every such figure asks.
    /// A sentence around it stays a localized key, which is what `Text(verbatim:)` would have cost.
    @Test(arguments: [1261, 999, 1_234_567])
    func `a figure Argo counted is written ungrouped and still localized`(count: Int) {
        #expect(Text("\(count, format: .machine)")._resolveText(in: Self.grouping) == "\(count)")
        #expect(
            Text("Load \(count, format: .machine) more")._resolveText(in: Self.grouping)
                == "Load \(count) more",
        )
    }

    @Test(arguments: [1261, 1000, 999, 1_234_567])
    func `the mark drawn is a hash and the digits, with no separator in it`(number: Int) {
        let drawn = Text(IssueReading.mark(number))._resolveText(in: Self.grouping)

        #expect(drawn == "#\(number)")
        #expect(!drawn.contains(","))
    }

    /// The row #1263 was reported against, read back off the row itself rather than off the helper
    /// it now asks: what the screenshot showed was `#1,261` in the backlog, and the number a row
    /// draws is the thing that has to be right.
    @Test
    func `a backlog row on a four-digit ticket draws the number unseparated`() {
        let row = TicketsRoomProjection.Row(
            id: 1261, title: "A ticket", delivery: .absent, trailing: nil, priority: nil,
            labels: [], children: [], marks: .none, touched: nil,
        )
        let drawn = TicketsRoomProjection.Drawn(row: row, depth: 0)
        let ink = BacklogRowInk(isSelected: false, isRail: false, palette: .graphite)

        let number = BacklogRow(drawn: drawn, isOpen: false, ink: ink, toggle: nil).number

        #expect(number._resolveText(in: Self.grouping) == "#1261")
    }

    /// The number reaches this one through a sentence rather than on its own, and a `String`
    /// interpolated into a localized key is substituted verbatim — so the sentence stays
    /// translatable and the number still does not group.
    @Test
    func `a number set inside a sentence keeps the same spelling`() {
        let drawn = TicketUnread(number: 1261).sentence._resolveText(in: Self.grouping)

        #expect(drawn == "Nothing has been read for #1261 yet.")
    }

    /// `words` is the spoken and hovered form of the same fact, so it cannot spell the number a
    /// second way — it is a `String` and never formats, and this holds it to the drawn one.
    @Test
    func `the worded form spells the number exactly as the mark does`() {
        #expect(IssueReading.words(number: 1261, title: nil) == IssueReading.mark(1261))
        // Through the joiner rather than a literal separator: the claim is about the NUMBER's
        // spelling, and it must not fail the next time the house form's punctuation changes.
        #expect(IssueReading.words(number: 1261, title: "Anchor the feed")
            .hasPrefix(IssueReading.mark(1261) + IssueReading.joiner))
    }
}
