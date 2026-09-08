@testable import AtlasLayout
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
    /// what the walk answered, both the plate's place in the list and the depth read off it.
    @Test func `the grid answers what a walk of the whole list answers`() {
        let index = AtlasPlateIndex(of: Self.plates)

        var disagreements: [String] = []
        var found = 0
        for x in stride(from: -12.0, through: 212.0, by: 3.0) {
            for y in stride(from: -12.0, through: 212.0, by: 3.0) {
                let point = CGPoint(x: x, y: y)
                let grid = index.plate(under: CGRect(origin: point, size: .zero))
                let walk = Self.walked(to: point, on: Self.plates)
                if grid?.place != walk || grid?.depth != walk.map({ Self.plates[$0].depth }) {
                    disagreements.append(
                        "at \(x), \(y): the grid says \(grid as Any), the walk \(walk as Any)",
                    )
                }
                if walk != nil {
                    found += 1
                }
            }
        }

        #expect(disagreements.isEmpty, "\(disagreements.prefix(4))")
        // Without this the sweep passes on a fixture where the walk finds nothing anywhere, which
        // is a pair of agreeing nils rather than an index that works.
        #expect(found > 1000)
    }

    /// The deepest plate wins, and the grid has to find it in whichever cell it was filed under.
    /// The innermost of a nest is the folder a decal on that ground belongs to (#1156).
    @Test func `the deepest plate over a point is the one answered`() throws {
        let index = AtlasPlateIndex(of: Self.plates)

        // Inside the third nested plate of the top-right quarter, which is three levels in.
        let deep = try #require(index.plate(under: CGRect(x: 148, y: 148, width: 2, height: 2)))

        #expect(deep.depth == 2)
        #expect(Self.plates[deep.place].path.hasPrefix("argo/q11/n"))
        // The shallower plates that also cover that point were passed over, not merely present.
        #expect(Self.plates[deep.place].rect.contains(CGPoint(x: 149, y: 149)))
    }

    /// The point a lookup is asked about is the rectangle's MIDDLE, not its corner: a decal is
    /// asked of its own thrown rect, and the plate it lands on is the plate its middle is over.
    @Test func `the middle of the rectangle is what decides`() throws {
        let index = AtlasPlateIndex(of: Self.plates)

        // A rect straddling the two left quarters, whose middle is in the upper one.
        let straddling = CGRect(x: 30, y: 90, width: 20, height: 40)
        let corner = try #require(index.plate(under: CGRect(x: 30, y: 90, width: 0, height: 0)))
        let middle = try #require(index.plate(under: straddling))

        #expect(middle.place == Self.walked(to: CGPoint(x: 40, y: 110), on: Self.plates))
        // And the two really are different plates, or the claim is about nothing.
        #expect(middle.place != corner.place)
    }

    /// A tiling with no folders in it: the decal lies on the desktop and names nothing, the same
    /// as the desktop does. Nothing, not a nearest plate and not a trap.
    @Test func `a plan with no plates answers nothing`() {
        let index = AtlasPlateIndex(of: [])

        #expect(index.plate(under: CGRect(x: 10, y: 10, width: 4, height: 4)) == nil)
    }

    /// A rect whose edge is not a measurement — a plan nothing tiled — answers rather than
    /// trapping the conversion into a cell.
    @Test(arguments: [CGFloat.infinity, -CGFloat.infinity, CGFloat.nan])
    func `an edge that is not a measurement answers nothing`(edge: CGFloat) {
        let index = AtlasPlateIndex(of: Self.plates)

        #expect(index.plate(under: CGRect(x: edge, y: edge, width: 0, height: 0)) == nil)
    }
}
