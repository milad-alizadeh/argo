import ArgoDesign
@testable import AtlasLayout
@testable import AtlasView
import CoreGraphics
import Testing

/// The table, in the pixels it is actually drawn in (#1600).
///
/// Every claim here renders through `AtlasVolumeRenderer.encode` — the same encode the cockpit's
/// own surface draws with — because the defect #1600 names is a picture: the app drew the boxes and
/// nothing else, and a test over the floor's own arithmetic would have passed on that tree.
@Suite("Atlas — the table the city stands on", .enabled(if: AtlasPickHarness.isAvailable))
@MainActor
struct AtlasTableTests {
    static let pigments = AtlasPickingTests.pigments

    /// The ground is GRADED, not one flat colour — the defect this ticket is about.
    ///
    /// Measured as two means rather than two pixels, and that is deliberate: the grain moves a
    /// single near-black pixel by up to one 8-bit step either way, so a claim about two of them
    /// would be a claim about the noise. Over a few thousand pixels the noise averages out and the
    /// grade is what is left.
    ///
    /// The direction is the design's own shape: the ground dips half way out from the middle of
    /// the plan before it returns to the desktop tone at the rim, so the ground the reader can see
    /// nearer the model is DARKER than the ground at the frame's corners. On the shipped tree both
    /// means are the desktop exactly and this reds.
    @Test func `the visible ground is graded, not one flat colour`() async throws {
        let harness = try #require(AtlasPickHarness(), AtlasPickingTests.unrenderable)
        let plan = AtlasPickingTests.plan()
        let camera = AtlasCamera.city(over: plan.extent)
        let frame = try #require(await harness.frame(
            of: AtlasVolumes.city(of: plan, in: Self.pigments), plan: plan, through: camera,
        ))

        let ground = Self.ground(in: frame, from: harness)
        #expect(ground.count > 1000, "the camera left too little bare ground to measure")
        let sorted = ground.map(\.reach).sorted()
        let median = sorted[sorted.count / 2]
        let near = ground.filter { $0.reach <= median }.map(\.light)
        let far = ground.filter { $0.reach > median }.map(\.light)

        #expect(Self.mean(near) < Self.mean(far), "the ground reads flat: no grade, no vignette")
    }

    /// Every patch of light on the floor reaches the SCREEN. Three renders, each with one of them
    /// taken out: a grid solved at the wrong divisions, a plate lighting nothing, or either one
    /// bounded away by the vignette is a floor that is drawn and cannot be seen.
    @Test func `the grid and the plates' light both reach the screen`() async throws {
        let harness = try #require(AtlasPickHarness(), AtlasPickingTests.unrenderable)
        let plan = AtlasPickingTests.plan()
        let city = AtlasVolumes.city(of: plan, in: Self.pigments)
        let lattice = AtlasFloor.grid.count
        let camera = AtlasCamera.city(over: plan.extent)

        let lit = try #require(await harness.frame(of: city, plan: plan, through: camera))
        let bare = try #require(await harness.frame(
            of: Self.floored(city, with: []), plan: plan, through: camera,
        ))
        let gridless = try #require(await harness.frame(
            of: Self.floored(city, with: city.patches.dropLast(lattice)),
            plan: plan,
            through: camera,
        ))
        let unlit = try #require(await harness.frame(
            of: Self.floored(city, with: city.patches.suffix(lattice)),
            plan: plan,
            through: camera,
        ))

        #expect(lit.colour != bare.colour)
        #expect(lit.colour != gridless.colour, "the contour grid is drawn and cannot be seen")
        #expect(lit.colour != unlit.colour, "the plates light nothing the reader can see")
    }

    /// Nothing on this map moves at rest, the grain included: two frames of one still map are the
    /// same bytes. A grain drawn from an unseeded generator, or a floor solved off a clock, would
    /// red here — and would also make every other pixel claim in this package unrepeatable.
    @Test func `two frames of a still map are the same picture`() async throws {
        let harness = try #require(AtlasPickHarness(), AtlasPickingTests.unrenderable)
        let plan = AtlasPickingTests.plan()
        let camera = AtlasCamera.city(over: plan.extent)
        let city = AtlasVolumes.city(of: plan, in: Self.pigments)

        let first = try #require(await harness.frame(of: city, plan: plan, through: camera))
        let second = try #require(await harness.frame(of: plan, through: camera))

        #expect(first.colour == second.colour)
    }

    /// A drag rewrites no floor. The floor is a function of the plan and the pigments, exactly as
    /// the boxes are, so a camera that moved is a table that did not (#1598) — the same object,
    /// which a fresh allocation holding the same bytes would fail.
    @Test func `a drag redraws the table from the patches already on the GPU`() async throws {
        let harness = try #require(AtlasPickHarness(), AtlasPickingTests.unrenderable)
        let plan = AtlasPickingTests.plan()
        let floor = try #require(harness.renderer.floor)

        harness.renderer.present(AtlasDragTests.projection(of: plan, yaw: 0), in: Self.pigments)
        let opening = try #require(await harness.frame())
        let patches = try #require(floor.patches)
        let count = floor.count
        #expect(count == AtlasFloor.patches(of: plan, in: Self.pigments).count)

        var latest: AtlasFrame?
        for step in 1 ... 8 {
            harness.renderer.present(
                AtlasDragTests.projection(of: plan, yaw: Double(step) * 0.08), in: Self.pigments,
            )
            latest = await harness.frame()
        }

        #expect(try #require(latest).colour != opening.colour)
        #expect(floor.patches === patches)
        #expect(floor.count == count)
    }

    /// The same city standing on a different floor, for a render that takes one patch out.
    private static func floored(
        _ city: AtlasCity,
        with patches: some Sequence<AtlasFloorPatch>,
    )
        -> AtlasCity {
        AtlasCity(
            volumes: city.volumes,
            roster: city.roster,
            patches: Array(patches),
            ground: city.ground,
        )
    }

    /// Every pixel of the frame that is on NO box — bare ground — as how far it sits from the
    /// middle of the plan and how bright it came out.
    ///
    /// "On no box" is asked of the id target rather than of the colour, so nothing here has to know
    /// what the ground is painted in to find it.
    private static func ground(
        in frame: AtlasFrame,
        from harness: AtlasPickHarness,
    )
        -> [(reach: Double, light: Double)] {
        let size = AtlasPickHarness.size
        let middle = CGPoint(x: Double(size.width) / 2, y: Double(size.height) / 2)
        return (0 ..< size.width * size.height).compactMap { index in
            let x = index % size.width
            let y = index / size.width
            guard harness.pick(at: AtlasPixel(x: x, y: y))?.target == nil else { return nil }
            let reach = (Double(x) - middle.x) * (Double(x) - middle.x)
                + (Double(y) - middle.y) * (Double(y) - middle.y)
            return (reach: reach.squareRoot(), light: Self.light(of: frame, atPixel: index))
        }
    }

    /// How bright one pixel of the frame came out, on the same three weights every other
    /// luminance in this contract is read on. BGRA, in the drawable's own order.
    private static func light(of frame: AtlasFrame, atPixel index: Int) -> Double {
        let weights = ArgoColor.rec709Weights
        return weights.blue * Double(frame.colour[index * 4])
            + weights.green * Double(frame.colour[index * 4 + 1])
            + weights.red * Double(frame.colour[index * 4 + 2])
    }

    private static func mean(_ values: [Double]) -> Double {
        values.isEmpty ? 0 : values.reduce(0, +) / Double(values.count)
    }
}
