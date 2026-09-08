import ArgoDesign
@testable import AtlasLayout
@testable import AtlasView
import CoreGraphics
import Testing

/// The table the city stands on, before a GPU is involved (#1600).
///
/// Two kinds of claim, and both fail silently without one: the struct layouts the shader reads
/// these through, and where the light on the floor actually lands. A field reordered draws a
/// plausible wrong floor; a plate lighting the floor at the wrong weight is a picture nobody can
/// tell from the design by looking.
@Suite("Atlas — the floor under the city")
struct AtlasFloorTests {
    static let pigments = AtlasPigments(
        ArgoPalette.graphite.atlas,
        rim: ArgoPalette.graphite.edge.hairline,
    )

    /// One patch, as `AtlasVolume.metal` declares it. Two `float4`s and a `float`, so both
    /// languages round the whole thing to 48 — but neither can see the other's declaration.
    @Test func `a floor patch is laid out the way the shader reads it`() {
        #expect(MemoryLayout<AtlasFloorPatch>.offset(of: \.plan) == 0)
        #expect(MemoryLayout<AtlasFloorPatch>.offset(of: \.wash) == 16)
        #expect(MemoryLayout<AtlasFloorPatch>.offset(of: \.divisions) == 32)
        #expect(MemoryLayout<AtlasFloorPatch>.stride == 48)
    }

    /// The floor's own numbers. The `float3`s are what make this worth asserting: they pack to 16
    /// bytes in both languages, so every offset after the first one is a padding rule agreeing.
    @Test func `the ground is laid out the way the shader reads it`() {
        #expect(MemoryLayout<AtlasGround>.offset(of: \.size) == 0)
        #expect(MemoryLayout<AtlasGround>.offset(of: \.lit) == 16)
        #expect(MemoryLayout<AtlasGround>.offset(of: \.deep) == 32)
        #expect(MemoryLayout<AtlasGround>.offset(of: \.rim) == 48)
        #expect(MemoryLayout<AtlasGround>.offset(of: \.grade) == 64)
        #expect(MemoryLayout<AtlasGround>.offset(of: \.falloff) == 72)
        #expect(MemoryLayout<AtlasGround>.offset(of: \.drop) == 80)
        #expect(MemoryLayout<AtlasGround>.offset(of: \.grain) == 84)
        #expect(MemoryLayout<AtlasGround>.stride == 96)
    }

    /// Every plate lights the floor under it, from its own whole footprint — and less the deeper it
    /// sits, or a tree 86 folders deep turns the ground into a flight of steps.
    @Test func `every plate lights the floor under it, and less the deeper it sits`() {
        let plan = Self.nested()
        let patches = AtlasFloor.patches(of: plan, in: Self.pigments)

        let plates = patches.prefix(plan.plates.count)
        #expect(plates.count == plan.plates.count)
        for (patch, plate) in zip(plates, plan.plates) {
            #expect(patch.divisions == 0)
            #expect(patch.plan == SIMD4<Float>(
                Float(plate.rect.minX), Float(plate.rect.minY),
                Float(plate.rect.width), Float(plate.rect.height),
            ))
        }
        let weights = plates.map(\.wash.w)
        #expect(zip(weights, weights.dropFirst()).allSatisfy { $1 < $0 })
    }

    /// The grid is the last thing on the floor, at two weights, over a floor that runs PAST the
    /// plan — the model is what the reader came for, and a floor stopping at the footprint would
    /// leave the city standing on its own outline.
    @Test func `the grid is drawn at two weights over a floor wider than the plan`() {
        let plan = Self.nested()
        let patches = AtlasFloor.patches(of: plan, in: Self.pigments)

        let lattice = patches.suffix(AtlasFloor.grid.count)
        #expect(lattice.map(\.divisions) == AtlasFloor.grid.map { Float($0.divisions) })
        #expect(lattice.map(\.wash.w) == AtlasFloor.grid.map { Float($0.weight) })
        for patch in lattice {
            #expect(patch.plan.x < 0)
            #expect(patch.plan.y < 0)
            #expect(patch.plan.z > Float(plan.extent.width))
            #expect(patch.plan.w > Float(plan.extent.height))
        }
    }

    /// The floor's light is the contract's own `fog` and nothing else. The design's page draws two
    /// raw cyans here; the contract already names the floor's light, so the weights carry the
    /// difference and the map grows no colour of its own (`AtlasFloor.plateLight`).
    @Test func `every patch of the floor's light is the contract's own fog`() {
        let fog = ArgoPalette.graphite.atlas.materials.fog
        let wanted = SIMD3<Float>(Float(fog.red), Float(fog.green), Float(fog.blue))

        for patch in AtlasFloor.patches(of: Self.nested(), in: Self.pigments) {
            #expect(SIMD3(patch.wash.x, patch.wash.y, patch.wash.z) == wanted)
        }
    }

    /// The floor is a real plane UNDER the plates, which is what makes the model read as hovering
    /// rather than as a city standing on nothing.
    @Test func `the floor lies under the plates, never on them`() {
        let ground = AtlasGround(plan: CGSize(width: 200, height: 150), in: Self.pigments)

        #expect(ground.drop < 0)
        #expect(abs(Double(ground.drop) + 150 * AtlasElevation.dropShare) < 0.001)
    }

    /// The tile is the same every time it is built. A grain drawn from an unseeded generator would
    /// be a picture that differed between two runs of the same still map, and "nothing moves at
    /// rest" would stop being a claim anybody could measure.
    @Test func `the grain tile is the same tile every time`() {
        let first = AtlasGrain.noise()

        #expect(first == AtlasGrain.noise())
        #expect(first.count == AtlasGrain.side * AtlasGrain.side)
        #expect(first.allSatisfy { AtlasGrain.range.contains($0) })
        // It is noise, not a fill: a generator returning one value, or a handful, would pass
        // everything above.
        #expect(Set(first).count > AtlasGrain.range.count / 2)
    }

    /// A plate at every depth, so the falloff has something to fall over.
    static func nested() -> AtlasPlan {
        let extent = CGSize(width: 200, height: 150)
        let plates = (0 ..< 4).map { depth in
            AtlasPlateFrame(
                path: (0 ... depth).map { "level-\($0)" }.joined(separator: "/"),
                rect: CGRect(origin: .zero, size: extent).insetBy(
                    dx: CGFloat(depth) * 8, dy: CGFloat(depth) * 6,
                ),
                depth: depth,
            )
        }
        return AtlasPlan(extent: extent, plates: plates, tiles: [])
    }
}
