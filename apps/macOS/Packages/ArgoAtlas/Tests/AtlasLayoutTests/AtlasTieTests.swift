@testable import AtlasLayout
import Foundation
import Testing

/// Which co-change ties the map draws (#1160).
///
/// The Map carries every Coupling the counting kept — 18,402 of them for this repository — and the
/// map draws a hundred and sixty. What is asserted here is the choosing: strongest first, one line
/// per pair, and the same answer twice for the same Map.
@Suite("Atlas — the ties the map draws")
struct AtlasTieTests {
    /// A Map whose Plots are named `f1` to `fN` and whose Couplings are handed in as written, so
    /// every claim below is about the CHOOSING rather than about a counting this suite does not
    /// own.
    private static func map(_ couplings: [AtlasCoupling], files: Int = 8) -> AtlasMap {
        AtlasMap(
            measuredAt: Date(),
            commit: nil,
            root: AtlasPlate(path: "root", children: (1 ... files).map {
                .plot(AtlasPlot(path: "root/f\($0).swift", measures: ["lines": 1]))
            }),
            relations: AtlasRelations(couplings: couplings),
        )
    }

    private static func tie(_ first: Int, _ second: Int, _ strength: Double) -> AtlasCoupling {
        AtlasCoupling(
            first: "root/f\(first).swift", second: "root/f\(second).swift", strength: strength,
        )
    }

    @Test
    func `the strongest ties come out strongest first`() {
        let map = Self.map([Self.tie(1, 2, 0.2), Self.tie(3, 4, 0.9), Self.tie(5, 6, 0.5)])
        #expect(map.couplings.strongest().map(\.strength) == [0.9, 0.5, 0.2])
    }

    /// The whole of #1160's "the number of ties drawn is capped": the cap is the map's, not the
    /// repository's, and a Map carrying more ties than the map can read hands over exactly the cap.
    @Test
    func `no more ties are drawn than the cap`() {
        let many = (1 ... 40).map { Self.tie($0, $0 + 1, Double($0) / 100) }
        #expect(Self.map(many, files: 41).couplings.strongest(cap: 10).count == 10)
        #expect(Self.map(many, files: 41).couplings.strongest(cap: 10).first?.strength == 0.4)
    }

    /// **One pair, one cord.** The counting settles which end is which, but a Map is a FILE and
    /// nothing stops one carrying a pair stated both ways round. Drawing both lays a second stroke
    /// over the first and spends a slot in the cap, so the second reading is dropped.
    @Test
    func `a reversed twin is the same tie, drawn once`() {
        let map = Self.map([Self.tie(1, 2, 0.6), Self.tie(2, 1, 0.6), Self.tie(3, 4, 0.4)])
        #expect(map.couplings.strongest().count == 2)
        #expect(map.couplings.strongest().first == Self.tie(1, 2, 0.6))
    }

    /// Two ties of one strength cannot swap between two readings of one Map: the paths break the
    /// tie, because Swift's sort is not stable and a map that redrew itself differently on every
    /// repaint would be a picture nobody can point at.
    @Test
    func `equal strengths are ordered by their own paths`() {
        let map = Self.map([Self.tie(5, 6, 0.5), Self.tie(1, 2, 0.5), Self.tie(3, 4, 0.5)])
        let ends = map.couplings.strongest().map(\.first)
        #expect(ends == ["root/f1.swift", "root/f3.swift", "root/f5.swift"])
    }

    /// A repository whose history paired nothing draws nothing, and says so by being empty rather
    /// than by failing.
    @Test
    func `a map that counted nothing draws no ties`() {
        #expect(Self.map([]).couplings.strongest().isEmpty)
        #expect(Self.map([]).couplings.ties(of: "root/f1.swift").isEmpty)
    }

    /// Pinning a file draws the files it changes with — from EITHER end of the pair, because a
    /// Coupling is one relation and the file that was written second is no less tied for it.
    @Test
    func `a file's own ties are the ones it stands at either end of`() {
        let map = Self.map([Self.tie(1, 2, 0.3), Self.tie(3, 1, 0.7), Self.tie(4, 5, 0.9)])
        let own = map.couplings.ties(of: "root/f1.swift")
        #expect(own.map(\.strength) == [0.7, 0.3])
    }

    /// The open file's own list is capped too, and by its own number: sixty cords off one box is
    /// a ball of wool, and the reader asked which files this one changes with rather than for all
    /// of them.
    @Test
    func `a file keeps no more of its own ties than the per-file cap`() {
        let many = (2 ... 20).map { Self.tie(1, $0, Double($0) / 100) }
        let own = Self.map(many, files: 20).couplings.ties(of: "root/f1.swift", limit: 4)
        #expect(own.count == 4)
        #expect(own.first?.strength == 0.2)
    }

    /// A file with no ties of its own is not a failure and not the whole list: it is nothing.
    @Test
    func `a file that changes with nothing draws nothing`() {
        let map = Self.map([Self.tie(2, 3, 0.5)])
        #expect(map.couplings.ties(of: "root/f1.swift").isEmpty)
    }
}
