@testable import AtlasLayout
import Foundation
import Testing

/// Which Measure the reader gets on each channel before choosing anything (#1161).
@Suite("Atlas — the opening channels")
struct AtlasChannelsTests {
    private static func map(measures: [String]) -> AtlasMap {
        AtlasMap(measuredAt: Date(), commit: nil, root: AtlasPlate(
            path: "root",
            children: [
                .plot(AtlasPlot(
                    path: "root/a",
                    measures: Dictionary(uniqueKeysWithValues: measures.map { ($0, 1.0) }),
                )),
            ],
        ))
    }

    @Test func `lines sizes the footprint over bytes, and commits colours it over authors`() {
        let channels = AtlasChannels.opening(for: Self.map(measures: [
            "bytes", "lines", "authors", "commits",
        ]))

        #expect(channels.footprint == "lines")
        #expect(channels.band == "commits")
        #expect(channels.height == "commits")
    }

    @Test func `bytes stands in for the footprint where the repository carries no lines`() {
        let channels = AtlasChannels.opening(for: Self.map(measures: ["bytes", "authors"]))

        #expect(channels.footprint == "bytes")
        #expect(channels.band == "authors")
    }

    /// Falls to whatever the repository DOES carry rather than a name it invented — sorted, so the
    /// choice does not depend on the order a generator happened to walk a file's measures in.
    @Test func `a repository with none of the preferred names falls back to its first Measure`() {
        let channels = AtlasChannels.opening(for: Self.map(measures: [
            "cyclomatic",
            "age_in_weeks",
        ]))

        #expect(channels.footprint == "age_in_weeks")
        #expect(channels.band == "age_in_weeks")
    }

    /// The height channel takes the band's Measure, never a third preference of its own — the room
    /// draws flat, where height reads as a name and not a reading, so a third guess here would be a
    /// claim nobody can see (#1161).
    @Test func `height always takes whatever the colour channel took`() {
        let channels = AtlasChannels.opening(for: Self.map(measures: ["lines", "commits"]))

        #expect(channels.height == channels.band)
    }

    @Test func `an unmeasured repository names no Measure on any channel`() {
        let channels = AtlasChannels.opening(for: AtlasMap(
            measuredAt: Date(), commit: nil, root: AtlasPlate(path: "root", children: []),
        ))

        #expect(channels.footprint.isEmpty)
        #expect(channels.band.isEmpty)
    }

    /// A choice restored from a previous session against a Map that has since been regenerated:
    /// the Measure set is open, so a name the new Map does not carry falls back per channel rather
    /// than opening a menu on a selection its own options do not hold (#1161).
    @Test func `a stored channel the Map no longer carries falls back`() {
        let map = Self.map(measures: ["lines", "commits"])
        let stored = AtlasChannels(footprint: "lines", band: "coverage", height: "commits")

        let held = stored.held(over: map)

        #expect(held.band == AtlasChannels.opening(for: map).band)
        #expect(held.footprint == "lines")
        #expect(held.height == "commits")
    }

    /// And a choice every channel of which the Map still carries comes back untouched — including
    /// one the opening reading would never have picked, which is the whole point of storing it.
    @Test func `a stored channel the Map still carries is kept`() {
        let map = Self.map(measures: ["lines", "commits", "authors"])
        let stored = AtlasChannels(footprint: "commits", band: "authors", height: "lines")

        #expect(stored.held(over: map) == stored)
    }
}
