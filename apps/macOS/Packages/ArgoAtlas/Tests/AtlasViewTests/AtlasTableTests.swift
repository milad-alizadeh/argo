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

        let ground = harness.bareGround(in: frame)
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

    /// Nothing on this map moves at rest, the grain included — measured the way the prototype
    /// measured it, as pixels changed at rest, of which there are none.
    ///
    /// The third render is what stops this passing for the wrong reason: a picture with no grain in
    /// it at all is byte-identical between two frames too, which is what the shipped tree was. So
    /// the grain has to be BOTH in the picture and the same in both frames.
    @Test func `two frames of a still map are the same picture, grain and all`() async throws {
        let harness = try #require(AtlasPickHarness(), AtlasPickingTests.unrenderable)
        let plan = AtlasPickingTests.plan()
        let camera = AtlasCamera.city(over: plan.extent)
        let city = AtlasVolumes.city(of: plan, in: Self.pigments)

        let first = try #require(await harness.frame(of: city, plan: plan, through: camera))
        let second = try #require(await harness.frame(of: plan, through: camera))
        var undithered = city.ground
        undithered.grain = 0
        let plain = try #require(await harness.frame(
            of: Self.grounded(city, on: undithered), plan: plan, through: camera,
        ))

        #expect(first.colour == second.colour)
        #expect(first.colour != plain.colour, "the grain is not in the picture")
    }

    /// The lamp reaches the middle of the plan: the ground there is the LIT stop, which is the half
    /// of the grade no test over the shipped fixture can see — the city stands on it. So the plan
    /// this one renders leaves its middle bare.
    @Test func `the ground under the lamp is the lit stop of the grade`() async throws {
        let harness = try #require(AtlasPickHarness(), AtlasPickingTests.unrenderable)
        let plan = Self.cornered()
        let projection = AtlasProjection(of: plan, through: .city(over: plan.extent))
        let frame = try #require(await harness.frame(
            of: AtlasVolumes.city(of: plan, in: Self.pigments),
            plan: plan,
            through: projection.camera,
        ))

        let middle = projection.viewPoint(
            x: plan.extent.width / 2,
            y: plan.extent.height / 2,
            height: AtlasElevation.drop(of: plan.extent),
        )
        let pixel = AtlasPixel(x: Int(middle.x), y: Int(middle.y))
        #expect(harness.pick(at: pixel)?.target == nil, "the middle of the plan is covered")
        // The DARKEST bare pixel of a small window, not the one at the middle: the lattice runs
        // about four pixels apart there and the plan's own middle lands on a crossing of it, so a
        // single pixel is as likely to be two grid lines as it is to be the ground. Everything on
        // the floor only ever ADDS light, so the darkest of them is the bare ground.
        let drawn = harness.darkestGround(around: pixel, in: frame)
        let materials = ArgoPalette.graphite.atlas.materials

        #expect(abs(drawn - materials.groundLit.frameLight) < 1.5)
        #expect(drawn > materials.groundDeep.frameLight)
        #expect(drawn > materials.desktop.frameLight)
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
        let laid = try #require(floor.laid)
        let patches = floor.patches
        #expect(patches == AtlasFloor.patches(of: plan, in: Self.pigments).count)

        var latest: AtlasFrame?
        for step in 1 ... 8 {
            harness.renderer.present(
                AtlasDragTests.projection(of: plan, yaw: Double(step) * 0.08), in: Self.pigments,
            )
            latest = await harness.frame()
        }

        #expect(try #require(latest).colour != opening.colour)
        #expect(floor.laid === laid)
        #expect(floor.patches == patches)
    }

    /// The same city on a different ground, for a render that turns one of its numbers off.
    private static func grounded(_ city: AtlasCity, on ground: AtlasGround) -> AtlasCity {
        AtlasCity(
            volumes: city.volumes, roster: city.roster, patches: city.patches, ground: ground,
        )
    }

    /// A plan whose plates leave the middle bare: one small plate in a corner, so the ground under
    /// the lamp is ground the frame can actually see.
    private static func cornered() -> AtlasPlan {
        let extent = CGSize(width: 200, height: 150)
        let rect = CGRect(x: 0, y: 0, width: 40, height: 30)
        return AtlasPlan(
            extent: extent,
            plates: [.init(path: "argo", rect: rect, depth: 0)],
            tiles: [AtlasTile(
                path: "argo/one",
                rect: rect.insetBy(dx: 4, dy: 3),
                band: .quiet,
                height: 8,
            )],
        )
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

    private static func mean(_ values: [Double]) -> Double {
        values.isEmpty ? 0 : values.reduce(0, +) / Double(values.count)
    }
}
