@testable import AtlasLayout
@testable import AtlasView
import CoreGraphics
import Testing

/// Which plate a point lands on, found through the grid rather than by filtering the list (#1598).
///
/// The oracle is the walk the index replaced, written out here rather than called: a test that
/// asserted the index's own answers back would agree with any grid whose arithmetic was
/// consistently wrong, which is the one way a spatial index fails.
@Suite("Atlas — which plate a point lands on")
struct AtlasPlateIndexTests {
    /// The walk `AtlasShadow` did once per file: every plate whose rect holds the point, deepest
    /// wins, and the FIRST of an equal pair — `max(by:)` keeps the earlier of two it cannot order.
    static func walked(to point: CGPoint, on plates: [AtlasPlateFrame]) -> Int? {
        plates.indices
            .filter { plates[$0].rect.contains(point) }
            .max { plates[$0].depth < plates[$1].depth }
    }

    /// Three levels of nesting over a 200×200 ground. The three plates inside each quarter are all
    /// one level in and each sits inside the last, so most of the ground is covered by several
    /// plates at ONE depth — which is what pins the tie-break rather than leaving it to luck. The
    /// last plate straddles all four quarters, which the tiler would never place and the index
    /// still has to file in every cell it reaches.
    static let plates: [AtlasPlateFrame] = {
        var plates = [AtlasPlateFrame(
            path: "argo", rect: CGRect(x: 0, y: 0, width: 200, height: 200), depth: 0,
        )]
        for column in 0 ..< 2 {
            for row in 0 ..< 2 {
                let quarter = CGRect(
                    x: CGFloat(column) * 100, y: CGFloat(row) * 100, width: 100, height: 100,
                )
                plates.append(AtlasPlateFrame(
                    path: "argo/q\(column)\(row)", rect: quarter, depth: 1,
                ))
                for inner in 0 ..< 3 {
                    plates.append(AtlasPlateFrame(
                        path: "argo/q\(column)\(row)/n\(inner)",
                        rect: quarter.insetBy(dx: CGFloat(inner) * 8 + 4, dy: 4),
                        depth: 2,
                    ))
                }
            }
        }
        plates.append(AtlasPlateFrame(
            path: "argo/across", rect: CGRect(x: 90, y: 90, width: 40, height: 40), depth: 2,
        ))
        return plates
    }()

    /// THE CLAIM, over every third point of the ground and a margin outside it: the grid answers
    /// what the walk answered, plate for plate.
    @Test func `the grid answers what a walk of the whole list answers`() {
        let index = AtlasPlateIndex(of: Self.plates)

        var disagreements: [String] = []
        for x in stride(from: -12.0, through: 212.0, by: 3.0) {
            for y in stride(from: -12.0, through: 212.0, by: 3.0) {
                let point = CGPoint(x: x, y: y)
                let grid = index.plate(under: CGRect(origin: point, size: .zero))
                let walk = Self.walked(to: point, on: Self.plates)
                if grid != walk {
                    disagreements.append(
                        "at \(x), \(y): the grid says \(grid as Any), the walk \(walk as Any)",
                    )
                }
            }
        }

        #expect(disagreements.isEmpty, "\(disagreements.prefix(4))")
    }

    /// The point a lookup is asked about is the rectangle's MIDDLE, not its corner: a decal is
    /// asked of its own thrown rect, and the plate it lands on is the plate its middle is over.
    @Test func `the middle of the rectangle is what decides`() {
        let index = AtlasPlateIndex(of: Self.plates)

        // A rect straddling the two left quarters, whose middle is in the upper one.
        let straddling = CGRect(x: 30, y: 90, width: 20, height: 40)
        #expect(index.plate(under: straddling)
            == Self.walked(to: CGPoint(x: 40, y: 110), on: Self.plates))
    }

    /// A tiling with no folders in it: the decal lies on the desktop and names nothing, the same
    /// as the desktop does. Nothing, not a nearest plate and not a trap.
    @Test func `a plan with no plates answers nothing`() {
        let index = AtlasPlateIndex(of: [])

        #expect(index.plate(under: CGRect(x: 10, y: 10, width: 4, height: 4)) == nil)
    }

    /// A rect whose edge is not a number — a plan nothing tiled — answers rather than trapping the
    /// conversion into a cell.
    @Test(arguments: [CGFloat.infinity, -CGFloat.infinity, CGFloat.nan])
    func `an edge that is not a measurement answers nothing`(edge: CGFloat) {
        let index = AtlasPlateIndex(of: Self.plates)

        #expect(index.plate(under: CGRect(x: edge, y: edge, width: 0, height: 0)) == nil)
    }

    /// The depth a plate sits at is read off the index rather than looked up again by the caller:
    /// the tone a decal is painted in and the folder it is picked as have to be one plate.
    @Test func `the index says how deep the plate it found sits`() throws {
        let index = AtlasPlateIndex(of: Self.plates)

        let deep = try #require(index.plate(under: CGRect(x: 148, y: 148, width: 2, height: 2)))
        #expect(index.depth(of: deep) == Self.plates[deep].depth)
        #expect(index.depth(of: 0) == 0)
    }
}
