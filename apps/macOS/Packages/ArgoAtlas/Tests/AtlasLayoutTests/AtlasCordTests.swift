@testable import AtlasLayout
import CoreGraphics
import Foundation
import Testing

/// One tie, drawn (#1160): an arc between two roofs, read off the same projection the surface was
/// drawn with — so a cord cannot land where its two files are not.
@Suite("Atlas — the cord one tie is drawn as")
struct AtlasCordTests {
    static let ground = CGSize(width: 800, height: 600)

    static let near = AtlasTile(
        path: "a/near", rect: CGRect(x: 60, y: 60, width: 120, height: 100), band: .hot, height: 40,
    )
    static let far = AtlasTile(
        path: "a/far", rect: CGRect(x: 500, y: 380, width: 160, height: 120), band: .quiet,
        height: 12,
    )
    /// A neighbour of `near`, close enough that the two roofs project onto very nearly one point.
    static let touching = AtlasTile(
        path: "a/touching", rect: CGRect(x: 61, y: 61, width: 120, height: 100), band: .hot,
        height: 40,
    )

    static func projection(relief: Double) -> AtlasProjection {
        AtlasProjection(
            of: AtlasPlan(extent: ground, tiles: [near, far, touching]),
            through: AtlasCamera(relief: relief, over: ground),
        )
    }

    static func cord(
        _ first: AtlasTile = near,
        _ second: AtlasTile = far,
        relief: Double,
        strength: Double = 0.5,
    )
        -> AtlasCord? {
        AtlasCord(
            between: first, and: second, through: projection(relief: relief), strength: strength,
        )
    }

    /// The two ends are the two roofs, projected — not the footprints, and not the boxes' corners.
    /// A cord that started at the ground would pass through the tower it leaves.
    @Test(arguments: [0.0, 1.0])
    func `a cord runs roof centre to roof centre`(_ relief: Double) throws {
        let projection = Self.projection(relief: relief)
        let cord = try #require(Self.cord(relief: relief))
        let start = projection.viewPoint(
            x: Self.near.rect.midX, y: Self.near.rect.midY, height: Self.near.height,
        )
        let end = projection.viewPoint(
            x: Self.far.rect.midX, y: Self.far.rect.midY, height: Self.far.height,
        )
        #expect(cord.start == start)
        #expect(cord.end == end)
    }

    /// Flat on there is no up: every cord bowed the same way on screen would make a bundle of them
    /// one shape. So the bow rotates INTO the plane — always to the same side of its own chord,
    /// which fans a bundle out — and it is exactly perpendicular to the chord it leans off.
    @Test
    func `flat on, the bow leans off the chord rather than up the screen`() throws {
        let cord = try #require(Self.cord(relief: 0))
        let chord = CGPoint(x: cord.end.x - cord.start.x, y: cord.end.y - cord.start.y)
        let middle = CGPoint(x: (cord.start.x + cord.end.x) / 2, y: (cord.start.y + cord.end.y) / 2)
        let lean = CGPoint(x: cord.control.x - middle.x, y: cord.control.y - middle.y)
        #expect(abs(lean.x * chord.x + lean.y * chord.y) < 0.001)
        let run = (chord.x * chord.x + chord.y * chord.y).squareRoot()
        let off = (lean.x * lean.x + lean.y * lean.y).squareRoot()
        #expect(abs(off - run * AtlasCord.planBow) < 0.001)
    }

    /// In the city the cord is bowed UP, off the ground it would otherwise run along — straight up
    /// the screen, and by a share of its own run so a long tie arcs higher than a short one.
    @Test
    func `in the city the bow lifts the cord off the ground`() throws {
        let cord = try #require(Self.cord(relief: 1))
        let middle = CGPoint(x: (cord.start.x + cord.end.x) / 2, y: (cord.start.y + cord.end.y) / 2)
        #expect(abs(cord.control.x - middle.x) < 0.001)
        let chord = CGPoint(x: cord.end.x - cord.start.x, y: cord.end.y - cord.start.y)
        let run = (chord.x * chord.x + chord.y * chord.y).squareRoot()
        #expect(abs((middle.y - cord.control.y) - run * AtlasCord.cityBow) < 0.001)
    }

    /// Two files whose boxes are on top of each other project onto nearly one point, and an arc
    /// across three pixels is a blot rather than a tie. Nothing, rather than a mark the reader
    /// cannot read as a line.
    @Test
    func `two roofs too close together draw no cord`() {
        #expect(Self.cord(Self.near, Self.touching, relief: 0) == nil)
    }

    /// The strength travels with the cord: it is what the drawing spends its brightness and its
    /// weight on, and a cord that lost it would draw the strongest tie in the repository the same
    /// as the hundred and sixtieth.
    @Test
    func `the cord carries the tie's own strength`() {
        #expect(Self.cord(relief: 1, strength: 0.82)?.strength == 0.82)
    }
}
