import ArgoEngine
@testable import ArgoUI
import Foundation
import Testing

/// A Ticket URL printed in the feed, said the way Argo says a Ticket (#1178).
@Suite("Feed ticket prose")
struct FeedTicketProseTests {
    private static let bound = FeedTicketLinks(
        address: TicketAddress(provider: .github, scope: "milad-alizadeh/argo"),
        titles: [1175: "Anchor the feed on its newest line"],
    )

    /// The same Binding with nothing named yet, which words a Ticket `#1175` alone.
    private static let unnamed = FeedTicketLinks(
        address: TicketAddress(provider: .github, scope: "milad-alizadeh/argo"),
    )

    /// One reading's setting, differing only in what it can say as a Ticket.
    private static func setting(_ tickets: FeedTicketLinks) -> FeedCellEnvironment.Setting {
        FeedCellEnvironment.Setting(
            colorScheme: .dark, dynamicTypeSize: .large, tickets: tickets,
        )
    }

    private static let link = "https://github.com/milad-alizadeh/argo/issues/1175"
    private static let foreign = "https://github.com/someone/else/issues/1175"

    @Test func `a recognised link is worded as its Ticket`() {
        #expect(
            FeedTicketProse.worded("Done: \(Self.link)", as: Self.bound)
                == "Done: [#1175: Anchor the feed on its newest line](\(Self.link))",
        )
    }

    /// The words are `IssueReading`'s, so the feed cannot disagree with the roster.
    @Test func `a Ticket nothing has named is worded by its number alone`() {
        #expect(
            FeedTicketProse.worded(Self.link, as: Self.unnamed) == "[#1175](\(Self.link))",
        )
    }

    @Test(arguments: [
        // Another repository the Project is not bound to.
        "See \(FeedTicketProseTests.foreign) for that one.",
        // A provider Argo reads nothing from.
        "See https://linear.app/argo/issue/ARG-12 for that one.",
        // Not a Ticket at all.
        "See https://example.com/notes for that one.",
    ])
    func `a link the Binding does not address is left alone`(prose: String) {
        #expect(FeedTicketProse.worded(prose, as: Self.bound) == prose)
    }

    /// Nothing is bound, so nothing is recognised — an unbound Project's feed is untouched.
    @Test func `an unbound Project rewords nothing`() {
        #expect(FeedTicketProse.worded(Self.link, as: .none) == Self.link)
    }

    /// A URL inside code is a URL. The agent that printed a `curl` line meant the characters.
    @Test(arguments: [
        "Run `curl \(FeedTicketProseTests.link)` first.",
        "```sh\ncurl \(FeedTicketProseTests.link)\n```",
        "```\n\(FeedTicketProseTests.link)\n```",
    ])
    func `a URL inside code is left as it was written`(prose: String) {
        #expect(FeedTicketProse.worded(prose, as: Self.bound) == prose)
    }

    /// The agent already said what its link is called, and that stands.
    @Test func `a link the agent already worded is left alone`() {
        let prose = "See [the anchor ticket](\(Self.link))."

        #expect(FeedTicketProse.worded(prose, as: Self.bound) == prose)
    }

    /// The markdown reader autolinks these and drops the punctuation after them, so the rewording
    /// has to find exactly the same run — otherwise a full stop would end up inside the link.
    @Test(arguments: [
        ("Fixed in \(FeedTicketProseTests.link).", "Fixed in <words>."),
        ("Fixed in \(FeedTicketProseTests.link), then shipped.", "Fixed in <words>, then shipped."),
        ("Fixed in (\(FeedTicketProseTests.link))", "Fixed in (<words>)"),
        ("\(FeedTicketProseTests.link) landed", "<words> landed"),
    ])
    func `the sentence around a link keeps its own punctuation`(prose: String, shape: String) {
        let worded = "[#1175: Anchor the feed on its newest line](\(Self.link))"

        #expect(
            FeedTicketProse.worded(prose, as: Self.bound)
                == shape.replacingOccurrences(of: "<words>", with: worded),
        )
    }

    /// A title is the provider's own prose. An unescaped bracket in it would end the link on the
    /// title's own punctuation and leave the rest of it loose in the sentence.
    @Test func `a title carrying markdown punctuation is escaped`() {
        let awkward = FeedTicketLinks(
            address: TicketAddress(provider: .github, scope: "milad-alizadeh/argo"),
            titles: [1175: "Fix [the] `ramp` *now*"],
        )

        #expect(
            FeedTicketProse.worded(Self.link, as: awkward)
                == "[#1175: Fix \\[the\\] \\`ramp\\` \\*now\\*](\(Self.link))",
        )
    }

    /// Two links in one paragraph, one of each — the case a single-match rewrite would get wrong.
    @Test func `every recognised link in a paragraph is worded and no other is`() {
        let prose = "Both \(Self.link) and \(Self.foreign) are open."

        #expect(
            FeedTicketProse.worded(prose, as: Self.bound)
                == "Both [#1175: Anchor the feed on its newest line](\(Self.link)) "
                + "and \(Self.foreign) are open.",
        )
    }

    /// The claim the rewrite actually makes, put through the reader that draws it: what the feed
    /// sets is the Ticket's words, and what the press carries is still the provider's own URL.
    /// Asserting the markdown alone would pass on a spelling the parser reads back as prose.
    @Test func `the reworded markdown reads back as one link on the Ticket`() {
        let worded = FeedTicketProse.worded("Fixed in \(Self.link).", as: Self.bound)
        let read = ProseReading.marked(worded)

        let links = read.runs.compactMap { run in
            run.link.map { ($0, String(read[run.range].characters)) }
        }
        #expect(links.count == 1)
        #expect(links.first?.0 == URL(string: Self.link))
        #expect(links.first?.1 == "#1175: Anchor the feed on its newest line")
    }

    /// The height the table sets a row to is taken off the words the surface will ink, not off the
    /// URL the record carried (ADR-0030, Rule 2). A long URL that wrapped to two lines and a short
    /// `#1175` that does not is exactly the drift nothing downstream could tell from a bug.
    @MainActor @Test func `a row is measured at the words it is drawn in`() {
        let row = FeedRow.Content.message("Fixed in \(Self.link)")
        let measure: CGFloat = 220

        let asRecord = FeedShapeHeight(
            standing: FeedRowStanding(), measure: measure, tickets: .none,
        )
        let asDrawn = FeedShapeHeight(
            standing: FeedRowStanding(), measure: measure, tickets: Self.unnamed,
        )

        // The URL wraps to a second line at this measure and `#1175` does not.
        #expect(asRecord.height(of: row) > asDrawn.height(of: row))
        #expect(
            asDrawn.height(of: row)
                == FeedProseFrame.of(
                    text: FeedTicketProse.worded("Fixed in \(Self.link)", as: Self.unnamed),
                    across: measure,
                ).height,
        )
    }

    /// A title arriving rewords every row that names that Ticket, so the whole reading owes a
    /// pass. Left out of the stamp, the heights would stand at the words they were taken under and
    /// the surfaces would ink longer ones into them.
    @Test func `a Ticket that gains a title re-wraps the reading`() {
        let rows = [FeedRow(id: 0, content: .message("Fixed in \(Self.link)"))]
        let untitled = FeedMeasureStamp(
            width: 620, setting: Self.setting(Self.unnamed), rows: rows,
            reader: FeedReaderStanding(),
        )
        let titled = FeedMeasureStamp(
            width: 620, setting: Self.setting(Self.bound), rows: rows,
            reader: FeedReaderStanding(),
        )

        #expect(titled.rewraps(against: untitled))
        #expect(!titled.rewraps(against: titled))
    }

    /// The rewording is what the feed DRAWS; the record's own words are what it copies.
    @Test func `prose with no URL in it comes back untouched`() {
        let prose = "## What I found\n\nThe ramp had drifted navy.\n\n- Nothing else moved."

        #expect(FeedTicketProse.worded(prose, as: Self.bound) == prose)
    }
}
