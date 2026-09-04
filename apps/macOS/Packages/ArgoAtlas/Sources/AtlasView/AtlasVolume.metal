// Every box of the city, drawn flat and unlit, through the one camera both views share (#1150).
//
// One instanced draw for the whole picture: a Plate and a file are the same primitive with a
// different pigment and a different height, so the walk that decided the map is also the order it
// is painted in. A plate's foot and roof are the same number, which makes its walls degenerate and
// leaves it the flat face it was at #1147.
//
// THERE IS ONE CAMERA AND IT IS A PARAMETER. `relief` runs 1 to 0: it scales every height, gates
// every wall by making it degenerate, and pushes the eye to infinity by falling out of `away`. At
// 0 this file draws exactly the treemap the flat shader drew at #1147 — `AtlasCameraTests`
// asserts that identity on the Swift side of the same arithmetic.
//
// Nothing here is lit, and that is the design's own rule rather than a stage this shader has not
// reached yet: NOTHING MAY BE LIT AT THE COST OF ITS BAND. A lambert term multiplied into a
// pigment moves a green file towards a colour the legend does not name, and a reader comparing two
// files would be reading the light. The light model arrives at #1151, and it arrives having to
// answer that rule.

#include <metal_stdlib>
using namespace metal;

/// One box: where it stands on the map, how tall it stands, and what it is painted in. Matching
/// `AtlasVolume` on the Swift side field for field — `float2` packs to 8 bytes and `float3` to 16
/// in both languages, which is what lets the two structs be written independently and still agree.
/// `AtlasVolumeTests` asserts the offsets.
struct AtlasVolume {
    float2 origin;
    float2 size;
    float2 heights;
    float3 pigment;
};

/// The camera, solved. Every number arrives resolved: nothing here is an angle.
struct AtlasEye {
    float2 centre;
    float2 yaw;    // (sin, cos)
    float2 pitch;  // (sin, cos)
    float2 scale;
    float2 offset;
    float relief;
    float distance;
};

/// One quad as two triangles, in its own unit square. A triangle LIST rather than a strip, because
/// three quads per instance in one draw is either this or degenerate triangles between them, and a
/// degenerate triangle is a thing to get wrong that draws a seam nobody can find.
constant float2 atlas_quad[6] = {
    float2(0, 0), float2(1, 0), float2(1, 1),
    float2(0, 0), float2(1, 1), float2(0, 1)
};

struct AtlasFragment {
    float4 position [[position]];
    /// Flat: every corner of a face carries the same pigment, and interpolating a constant is a
    /// rounding error waiting to put a file a hair off the band it was drawn in.
    float3 pigment [[flat]];
};

/// One point of the model, in clip space.
///
/// The divide is left to the HARDWARE — `w` is the distance along the view axis and the depth is
/// the classic `1/z` — rather than done here and handed over as ready coordinates. Both are the
/// same picture, and only this one interpolates a plane's depth exactly: a nested plate and the
/// plate it stands on are the same plane, and a linear guess at their depth is two surfaces
/// fighting over every pixel they share.
static float4 atlas_clip(float3 point, constant AtlasEye &eye) {
    float2 d = point.xy - eye.centre;
    // `into` runs AWAY from the reader, which is why the two y terms carry these signs: the plan
    // measures y down from its top left, and the top of the map is its far edge.
    float across = d.x * eye.yaw.y + d.y * eye.yaw.x;
    float into = d.x * eye.yaw.x - d.y * eye.yaw.y;
    float raised = point.z * eye.relief;
    float away = eye.distance + (into * eye.pitch.y - raised * eye.pitch.x) * eye.relief;

    float2 plane = float2(across, into * eye.pitch.x + raised * eye.pitch.y);
    // The near and far planes bracket every distance this camera can reach: `away` never leaves
    // the eye by more than the plan itself, and the plan is a fraction of the eye's own distance.
    float near = eye.distance * 0.1;
    float far = eye.distance * 4.0;
    return float4(
        plane * eye.scale + eye.offset * away,
        (far / (far - near)) * (away - near),
        away
    );
}

vertex AtlasFragment atlas_volume_vertex(
    uint vertex_id [[vertex_id]],
    uint volume_id [[instance_id]],
    const device AtlasVolume *volumes [[buffer(0)]],
    constant AtlasEye &eye [[buffer(1)]]
) {
    AtlasVolume volume = volumes[volume_id];
    float2 low = volume.origin;
    float2 high = volume.origin + volume.size;
    float foot = volume.heights.x;
    float roof = volume.heights.y;

    // Which two walls face the reader depends only on the yaw, so every box in one frame shows the
    // same pair: the near corner is the one the turn puts closest, and the two walls meeting there
    // are the two that can be seen.
    float nearX = eye.yaw.x >= 0 ? low.x : high.x;
    float nearY = eye.yaw.y >= 0 ? high.y : low.y;

    uint face = vertex_id / 6;
    float2 unit = atlas_quad[vertex_id % 6];
    float3 point;
    if (face == 0) {
        point = float3(mix(low.x, high.x, unit.x), mix(low.y, high.y, unit.y), roof);
    } else if (face == 1) {
        point = float3(nearX, mix(low.y, high.y, unit.x), mix(foot, roof, unit.y));
    } else {
        point = float3(mix(low.x, high.x, unit.x), nearY, mix(foot, roof, unit.y));
    }

    AtlasFragment out;
    out.position = atlas_clip(point, eye);
    out.pigment = volume.pigment;
    return out;
}

fragment float4 atlas_volume_fragment(AtlasFragment in [[stage_in]]) {
    return float4(in.pigment, 1);
}
