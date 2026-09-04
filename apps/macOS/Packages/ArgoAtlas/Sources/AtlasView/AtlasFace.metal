// Every rectangle of the map, drawn flat and unlit (#1147).
//
// One instanced draw for the whole picture: a Plate and a file are the same primitive with a
// different pigment, so the walk that decided the map is also the order it is painted in.
//
// Nothing here is lit, and that is the design's own rule rather than a stage this shader has not
// reached yet: NOTHING MAY BE LIT AT THE COST OF ITS BAND. A lambert term multiplied into a
// pigment moves a green file towards a colour the legend does not name, and a reader comparing two
// files would be reading the light. The light model arrives at #1151 with the volumes it belongs
// to, and it arrives having to answer that rule.

#include <metal_stdlib>
using namespace metal;

/// One rectangle: where it sits on the map, and what it is painted in. Matching
/// `AtlasFace` on the Swift side field for field — `float2` packs to 8 bytes and `float3` to 16 in
/// both languages, which is what lets the two structs be written independently and still agree.
/// `AtlasFaceTests` asserts the offsets.
struct AtlasFace {
    float2 origin;
    float2 size;
    float3 pigment;
};

/// The ground every face is placed on: the plan's extent, in the points it was tiled in.
struct AtlasGround {
    float2 extent;
};

/// The four corners of a rectangle, as a triangle strip, in the face's own unit square.
constant float2 atlas_face_corners[4] = {
    float2(0, 0), float2(1, 0), float2(0, 1), float2(1, 1)
};

struct AtlasFragment {
    float4 position [[position]];
    /// Flat: every corner of a face carries the same pigment, and interpolating a constant is a
    /// rounding error waiting to put a file a hair off the band it was drawn in.
    float3 pigment [[flat]];
};

vertex AtlasFragment atlas_face_vertex(
    uint corner [[vertex_id]],
    uint face_index [[instance_id]],
    const device AtlasFace *faces [[buffer(0)]],
    constant AtlasGround &ground [[buffer(1)]]
) {
    AtlasFace face = faces[face_index];
    float2 point = face.origin + atlas_face_corners[corner] * face.size;
    float2 unit = point / ground.extent;
    // The plan measures from the TOP left and clip space from the bottom left, so y flips here.
    // One flip, in the one place that turns a plan into pixels: a renderer that flipped twice
    // draws a plausible map with its folders upside down.
    AtlasFragment out;
    out.position = float4(unit.x * 2 - 1, 1 - unit.y * 2, 0, 1);
    out.pigment = face.pigment;
    return out;
}

fragment float4 atlas_face_fragment(AtlasFragment in [[stage_in]]) {
    return float4(in.pigment, 1);
}
