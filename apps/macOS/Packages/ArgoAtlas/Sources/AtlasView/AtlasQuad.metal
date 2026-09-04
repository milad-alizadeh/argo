// One lit quad — the whole of the Atlas's renderer today (#1144).
//
// This file exists to answer one question and no other: does a `.metal` source in this tree
// survive the macOS CI job? `ArgoEngine` pins SwiftTerm below 1.12 because that release's shader
// makes an Xcode build need a separately-downloaded Metal Toolchain, and nobody had tested
// whether the same is true of a shader we own. The answer is written on #1144.
//
// So it draws a plate and stops. No camera, no instancing, no depth: those arrive with the
// tickets that need them, and every one of them is cheaper to write once this file is known to
// build. What it DOES exercise is the part that cannot be deferred — `ArgoLight`'s three lamps
// spent on a pigment, per fragment, which is the model every later face is shaded by.

#include <metal_stdlib>
using namespace metal;

/// One lamp, matching `AtlasUniforms.Lamp` on the Swift side field for field. `float3` is 16-byte
/// aligned in both languages, which is what lets the two structs be written independently and
/// still agree.
struct AtlasLamp {
    float3 direction;
    float3 tint;
    float intensity;
};

/// Everything the frame is drawn from. The numbers are `ArgoLight`'s and `AtlasMaterials`', passed
/// in rather than written here: a shader that hard-codes a lamp is a second contract.
struct AtlasUniforms {
    float3 pigment;
    float3 normal;
    float3 ambient;
    /// Half-extent of the quad in normalised device coordinates, so the ground shows around it.
    /// It sits AHEAD of the lamps because Metal rounds a struct's size up to its alignment and
    /// Swift does not — a scalar after a lamp lands 12 bytes apart in the two languages, and
    /// nothing but `AtlasUniformsTests` would say so.
    float half_extent;
    AtlasLamp key;
    AtlasLamp fill;
};

/// The four corners of the quad, as a triangle strip. Clip space directly: there is no camera yet
/// and a matrix that transformed nothing would be a promise this ticket cannot keep.
constant float2 atlas_corners[4] = {
    float2(-1, -1), float2(1, -1), float2(-1, 1), float2(1, 1)
};

vertex float4 atlas_quad_vertex(
    uint corner [[vertex_id]],
    constant AtlasUniforms &uniforms [[buffer(0)]]
) {
    return float4(atlas_corners[corner] * uniforms.half_extent, 0, 1);
}

/// One lamp's contribution: a lambert term, driven, spent as a per-channel multiplier on the
/// pigment. `max` rather than `abs` — a face turned away from a lamp is unlit by it, not lit from
/// behind.
static float3 atlas_lit_by(AtlasLamp lamp, float3 normal) {
    float lambert = max(dot(normal, normalize(lamp.direction)), 0.0);
    return lamp.tint * (lambert * lamp.intensity);
}

fragment float4 atlas_quad_fragment(constant AtlasUniforms &uniforms [[buffer(0)]]) {
    float3 light = uniforms.ambient
        + atlas_lit_by(uniforms.key, uniforms.normal)
        + atlas_lit_by(uniforms.fill, uniforms.normal);
    // Clamped, not normalised: `ArgoColor.scaled(by:)` clamps the same way, so a face and its
    // legend swatch stay the same colour under the same light.
    return float4(min(uniforms.pigment * light, 1.0), 1);
}
