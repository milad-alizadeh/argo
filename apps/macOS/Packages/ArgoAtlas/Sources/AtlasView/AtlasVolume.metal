// Every box of the city, through the one camera both views share (#1150), lit by one warm key and
// one cool fill and never at the cost of its band (#1151).
//
// One instanced draw for the whole picture: a Plate and a file are the same primitive with a
// different pigment and a different height, so the walk that decided the map is also the order it
// is painted in. A plate's foot and roof are the same number, which makes its walls degenerate and
// leaves it the flat face it was at #1147.
//
// THERE IS ONE CAMERA AND IT IS A PARAMETER. `relief` runs 1 to 0: it scales every height, gates
// every wall by making it degenerate, and pushes the eye to infinity by falling out of `away`. The
// SAME parameter gates the light: at 0 every term in `atlas_light` below multiplies out to 1 and
// this file draws exactly the treemap the flat shader drew at #1147, unlit.
//
// NOTHING TESTS THIS FILE. `AtlasCameraTests` asserts the identity over `AtlasCamera` and
// `AtlasFit`, `AtlasLightingTests` asserts the numbers `AtlasLighting` solves, and `AtlasVolumeTests`
// asserts the struct layouts — all three are a second copy of an expression below written in
// Swift. An edit to `atlas_clip` or `atlas_light` alone is caught by no test and by no build: what
// says the two agree is that they are the same expression, term for term.
//
// NOTHING MAY BE LIT AT THE COST OF ITS BAND. `atlas_light` returns one SCALAR, never a tinted
// vector: every lamp's own colour was already spent, in `AtlasLighting`, as how bright it reads —
// not as a channel it leans the pigment toward. A lambert term multiplied CHANNEL BY CHANNEL into
// a pigment moves a green file towards a colour the legend does not name, and a reader comparing
// two files would be reading the light rather than the band.

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
    /// A baked-in darkening, spent on top of the light model rather than instead of it: 1 for an
    /// ordinary face, below 1 for a cast shadow's decal (#1151).
    float shade;
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

/// The light, solved. `AtlasLighting` on the Swift side folds every lamp's direction and tint down
/// to these three numbers — camera-independent, because the two walls a fixed yaw ever shows never
/// change which lamp rakes across them — plus the wall's own contact term.
struct AtlasLighting {
    float roof;
    float nearX;
    float nearY;
    float contactFoot;
};

/// One quad as two triangles, in its own unit square.
constant float2 atlas_quad[6] = {
    float2(0, 0), float2(1, 0), float2(1, 1),
    float2(0, 0), float2(1, 1), float2(0, 1)
};

struct AtlasFragment {
    float4 position [[position]];
    /// Flat: every corner of a face carries the same pigment, and interpolating a constant is a
    /// rounding error waiting to put a file a hair off the band it was drawn in.
    float3 pigment [[flat]];
    /// Every SCALAR the fragment multiplies in: the face's own light and the volume's baked
    /// `shade`, both already gated by `relief` and both the same for every corner of a face — so
    /// this, too, is flat, and for the reason `pigment` is.
    float light [[flat]];
    /// The wall's own contact term, NOT flat: it is what draws the gradient down to `contactFoot`
    /// at the foot, and a gradient is the one thing here that has to interpolate. On the roof it
    /// is 1 at every corner, so interpolating it costs nothing there.
    float contact;
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
    constant AtlasEye &eye [[buffer(1)]],
    constant AtlasLighting &lighting [[buffer(2)]]
) {
    AtlasVolume volume = volumes[volume_id];
    float2 low = volume.origin;
    float2 high = volume.origin + volume.size;
    float foot = volume.heights.x;
    float roof = volume.heights.y;

    // The near corner: the plan corner this turn puts closest, and the two walls meeting there are
    // the two that can be seen. It is the same corner for every box in a frame, because it depends
    // on the yaw alone. THIS CAMERA CANNOT TURN — `AtlasCamera.yaw` is `cityYaw * relief`, so the
    // yaw only ever runs 0 to 45° and both its sine and cosine are non-negative. A reader who can
    // turn the map (#1152) has to pick these two off the SIGNS of `eye.yaw` again, or every box in
    // the city shows its far walls.
    float nearX = low.x;
    float nearY = high.y;

    uint face = vertex_id / 6;
    float2 unit = atlas_quad[vertex_id % 6];
    float3 point;
    // The face's own light, and its own contact term before the foot's gradient runs on it: the
    // roof carries no gradient at all, which is why its `along` is 1 at every corner rather than a
    // coordinate the quad varies.
    float faceLight;
    float along;
    if (face == 0) {
        point = float3(mix(low.x, high.x, unit.x), mix(low.y, high.y, unit.y), roof);
        faceLight = lighting.roof;
        along = 1;
    } else if (face == 1) {
        point = float3(nearX, mix(low.y, high.y, unit.x), mix(foot, roof, unit.y));
        faceLight = lighting.nearX;
        along = unit.y;
    } else {
        point = float3(mix(low.x, high.x, unit.x), nearY, mix(foot, roof, unit.y));
        faceLight = lighting.nearY;
        along = unit.y;
    }

    AtlasFragment out;
    out.position = atlas_clip(point, eye);
    out.pigment = volume.pigment;
    // Both scalars this file ever multiplies onto a pigment run out to 1 as `relief` runs to 0:
    // the directional face light, because an unlit treemap has no faces to tell apart, and the
    // volume's own baked `shade`, because a shadow is a statement about height and the treemap
    // draws none.
    out.light = mix(1.0, faceLight, eye.relief) * mix(1.0, volume.shade, eye.relief);
    float contact = mix(lighting.contactFoot, 1.0, along);
    out.contact = mix(1.0, contact, eye.relief);
    return out;
}

fragment float4 atlas_volume_fragment(AtlasFragment in [[stage_in]]) {
    return float4(in.pigment * in.light * in.contact, 1);
}
