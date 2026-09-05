@testable import AtlasLayout
import CoreGraphics
import Foundation
import Testing

/// How the open file is marked (#1154). The rule the ticket states absolutely: focus never
/// repaints the thing it marks — so the whole mark is geometry, and geometry is a thing a number
/// can hold to the picture.
@Suite("Atlas — tracing the open file")
struct AtlasTraceTests {
    static let ground = CGSize(width: 800, height: 600)

    static let standing = AtlasTile(
        path: "a/tower",
        rect: CGRect(x: 100, y: 50, width: 200, height: 120),
        band: .hot,
        height: 90,
    )

    /// As shallow as a file measuring nothing stands, which is the height the standing corners
    /// stop being worth tracing at.
    static let flatOnTheGround = AtlasTile(
        path: "a/slab",
        rect: CGRect(x: 300, y: 200, width: 240, height: 160),
        band: .quiet,
        height: AtlasElevation.floor(of: ground),
    )

    static func plan(_ tiles: [AtlasTile]) -> AtlasPlan {
        AtlasPlan(
            extent: ground,
            plates: [.init(path: "a", rect: CGRect(origin: .zero, size: ground), depth: 0)],
            tiles: tiles,
        )
    }

    static func trace(
        of tile: AtlasTile,
        relief: Double,
        orientation: AtlasOrientation = .opening,
    )
        -> AtlasTrace {
        AtlasTrace(
            of: tile,
            through: AtlasProjection(
                of: plan([tile]),
                through: AtlasCamera(relief: relief, orientation: orientation, over: ground),
            ),
        )
    }

    /// The treemap is the map seen straight down, so the trace of a rectangle IS that rectangle.
    /// The claim is worth a number rather than an eye: a mark two points off the tile it marks
    /// looks right on its own and points at the file next door at the seam.
    @Test func `seen straight down, the trace is the file's own rectangle`() {
        let strokes = Self.trace(of: Self.standing, relief: 0).strokes

        #expect(strokes.count == 1)
        let corners = Set(strokes[0].map { CGPoint(x: $0.x.rounded(), y: $0.y.rounded()) })
        #expect(corners == [
            CGPoint(x: 100, y: 50), CGPoint(x: 300, y: 50),
            CGPoint(x: 300, y: 170), CGPoint(x: 100, y: 170),
        ])
    }

    /// A closed loop: the roof is walked from the far corner round to itself, so the last point is
    /// the first. Left open it draws a box with one edge missing, on whichever side the reader is
    /// least likely to be looking.
    @Test func `the roof closes on itself`() {
        let roof = Self.trace(of: Self.standing, relief: 1).strokes[0]

        #expect(roof.first == roof.last)
        // Four corners, the last being the first again — the whole roof and no edge of it missing.
        #expect(Set(roof.map(\.debugDescription)).count == 4)
    }

    /// The whole volume, edge by edge. A box seen from outside shows SEVEN of its eight corners:
    /// the four of the roof, and the three of the foot that are not hidden behind the box itself.
    /// The eighth is the far bottom corner, and tracing it would draw a cage rather than this box
    /// being the one.
    @Test func `a standing file traces every corner of itself the reader can see`() {
        let trace = Self.trace(of: Self.standing, relief: 1)

        let drawn = Set(trace.strokes.flatMap(\.self).map(\.debugDescription))
        #expect(drawn.count == 7)
    }

    /// The mark reaches the GROUND, which is what makes it read as a volume rather than as a
    /// rectangle floating over the map. Flat on it would not — every corner projects onto the
    /// footprint there — so the claim is about the city.
    @Test func `a standing file's trace runs from its roof down to the ground it stands on`() {
        let trace = Self.trace(of: Self.standing, relief: 1)
        let plan = Self.plan([Self.standing])
        let projection = AtlasProjection(
            of: plan, through: AtlasCamera(relief: 1, over: Self.ground),
        )
        let corner = Self.standing.rect.origin
        let foot = projection.viewPoint(x: corner.x, y: corner.y, height: 0)
        let roof = projection.viewPoint(x: corner.x, y: corner.y, height: Self.standing.height)

        let drawn = Set(trace.strokes.flatMap(\.self).map(\.debugDescription))
        #expect(drawn.contains(foot.debugDescription))
        #expect(drawn.contains(roof.debugDescription))
    }

    /// Flat on, every edge of a box projects onto its own footprint: tracing the standing corners
    /// as well would draw one rectangle four times over and read as a stutter, not a shape.
    @Test func `a file standing no taller than the floor traces its roof alone`() {
        #expect(Self.trace(of: Self.flatOnTheGround, relief: 1).strokes.count == 1)
    }

    /// The seam belongs on the corner FURTHEST from the reader, and which corner that is changes
    /// as they turn the city — so it is solved per camera rather than fixed to one pair of sides.
    ///
    /// Checkable by eye, which is why it is asserted this way: the furthest corner of a roof is
    /// the one drawn highest on the screen, at every yaw. The trace starts and ends there, and the
    /// three corners that come down to a standing edge are the other three.
    @Test(arguments: [0.0, .pi / 4, 2.1, .pi + 0.4])
    func `the trace's seam sits on the corner furthest from the reader`(yaw: Double) {
        let roof = Self.trace(
            of: Self.standing,
            relief: 1,
            orientation: AtlasOrientation(yaw: yaw, pitch: 0.6155),
        ).strokes[0]

        #expect(roof[0].y == roof.map(\.y).min())
    }

    /// The fit frames the whole picture into the viewport, so a file on the map is a trace on the
    /// screen. A stroke off the edge is a mark for a file the reader cannot see it on.
    @Test(arguments: [0.0, 0.5, 1.0]) func `every traced point lands in the viewport`(
        relief: Double,
    ) {
        let inside = CGRect(origin: .zero, size: Self.ground).insetBy(dx: -0.5, dy: -0.5)

        for point in Self.trace(of: Self.standing, relief: relief).strokes.flatMap(\.self) {
            #expect(inside.contains(point))
        }
    }
}
