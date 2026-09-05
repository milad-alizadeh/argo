import AtlasFixtures
@testable import AtlasLayout
import Foundation
import Testing

/// What a reader is told when they open a file beside the map (#1154). Every claim here is one a
/// reader could check with their eyes on the panel — what it says, and what it refuses to say
/// about a number nobody measured.
@Suite("Atlas — a file's reading")
struct AtlasFileReadingTests {
    /// Ten files measuring 1 to 10 lines, so a place in the distribution is countable by hand. One
    /// of them carries no history at all, which is what git leaves behind for a file added to the
    /// index and never committed.
    static func ladder() throws -> AtlasMap {
        let measured = (1 ... 9).map { step in
            #"""
            {"kind": "plot", "name": "f\#(step).swift",
             "measures": {"lines": \#(step), "commits": \#(step), "authors": 1,
                          "age_in_weeks": 0, "bytes": \#(step * 40)}}
            """#
        }
        let bare = #"{"kind": "plot", "name": "f10.swift", "measures": {"lines": 10}}"#
        return try AtlasMap(decoding: Data("""
        {"version": 1, "measuredAt": "2026-09-04T00:00:00Z", "commit": null,
         "root": {"name": "ladder", "children": [\((measured + [bare]).joined(separator: ","))]}}
        """.utf8))
    }

    static let channels = AtlasChannels(footprint: "lines", band: "commits", height: "bytes")

    /// The four the acceptance criterion names, in the order the panel states them. All four
    /// always: a reading that dropped what a file has no value for would tell two files different
    /// stories and leave the reader to notice.
    @Test func `the reading states lines, authors, commits and age`() throws {
        let reading = try #require(AtlasFileReading(
            of: "ladder/f4.swift", in: Self.ladder(), by: Self.channels,
        ))

        #expect(reading.facts.map(\.fact) == [.lines, .authors, .commits, .age])
        #expect(reading.facts.map(\.value) == [4, 1, 4, 0])
    }

    /// The acceptance criterion in full: absent is not zero. A file git has no history for carries
    /// no commits rather than none of them, and the panel has to be able to tell the reader which.
    @Test func `a measure the file was never measured for reads as absent, not as zero`() throws {
        let reading = try #require(AtlasFileReading(
            of: "ladder/f10.swift", in: Self.ladder(), by: Self.channels,
        ))

        #expect(reading.facts.first { $0.fact == .lines }?.value == 10)
        for fact in [AtlasFact.authors, .commits, .age] {
            #expect(reading.facts.first { $0.fact == fact }?.value == nil)
        }
        #expect(reading.rows.first { $0.measure == "bytes" }?.value == nil)
    }

    /// The colour channel is the one Measure a number cannot carry, so it is the one drawn against
    /// the repository's own spread. Four of the nine measured files score below 5.
    @Test func `the banded measure is placed against this repository's own spread`() throws {
        let reading = try #require(AtlasFileReading(
            of: "ladder/f5.swift", in: Self.ladder(), by: Self.channels,
        ))

        let placement = try #require(reading.gauge.placement)
        #expect(reading.gauge.measure == "commits")
        #expect(placement.value == 5)
        #expect(placement.fraction == 4.0 / 9.0)
        #expect(placement.band == .quiet)
    }

    /// A needle standing at the left of the ramp is a measurement, and this file has none — so the
    /// gauge still names the Measure and places nothing.
    @Test func `a file with no value for the banded measure is placed nowhere`() throws {
        let reading = try #require(AtlasFileReading(
            of: "ladder/f10.swift", in: Self.ladder(), by: Self.channels,
        ))

        #expect(reading.gauge.measure == "commits")
        #expect(reading.gauge.placement == nil)
    }

    /// The table is what is LEFT: the four plain facts are stated above it and the banded Measure
    /// is drawn above that, so listing any of them again would say one number twice.
    @Test func `the table lists every measure the facts and the gauge did not`() throws {
        let reading = try #require(AtlasFileReading(
            of: "ladder/f4.swift", in: Self.ladder(), by: Self.channels,
        ))

        #expect(reading.rows.map(\.measure) == ["bytes"])
        #expect(reading.rows.map(\.isDrawn) == [true])
    }

    /// Marked because the reader is comparing numbers, and one of them is the picture they are
    /// looking at. `bytes` is on the height channel above; here nothing is.
    @Test func `a measure driving no channel is not marked as drawn`() throws {
        let reading = try #require(AtlasFileReading(
            of: "ladder/f4.swift",
            in: Self.ladder(),
            by: AtlasChannels(footprint: "lines", band: "commits", height: "lines"),
        ))

        #expect(reading.rows.map(\.isDrawn) == [false])
    }

    /// Nothing rather than an empty reading: a panel with no numbers says the file was never
    /// measured, and a path the Map does not hold is not that.
    @Test func `a path the map does not hold has no reading at all`() throws {
        #expect(try AtlasFileReading(
            of: "ladder/nobody.swift", in: Self.ladder(), by: Self.channels,
        ) == nil)
    }

    /// Against the committed measurement rather than a ladder, because the shape that matters on a
    /// real repository is the one the fixture was kept for: a file measured for size and for
    /// nothing else.
    @Test func `an unmeasured file in the real measurement says so on every count`() throws {
        let map = try AtlasMapFixture.argo()
        let reading = try #require(AtlasFileReading(
            of: "argo/docs/designs/composer-picker/at-filter.png",
            in: map,
            by: AtlasChannels.opening(for: map),
        ))

        #expect(reading.facts.first { $0.fact == .lines }?.value == nil)
        #expect(reading.name == "at-filter.png")
    }
}
