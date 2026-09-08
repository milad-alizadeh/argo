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
// `AtlasFit`, `AtlasLightingTests` asserts the numbers `AtlasLighting` solves, `AtlasRiseTests`
// asserts the curve one box climbs, and `AtlasVolumeTests` asserts the struct layouts — all four
// are a second copy of an expression below written in Swift. An edit to `atlas_clip`, `atlas_light`
// or `atlas_growth` alone is caught by no test and by no build: what says the two agree is that
// they are the same expression, term for term.
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
    /// Which file this box is: 0 for everything that is not one (#1153). It spends the four bytes
    /// the `float3` below already pads out, which is why picking costs the instance buffer nothing.
    uint id;
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

/// The city standing up out of its plates, as one clock (#1421). `AtlasRise` on the Swift side is
/// the same four fields and the same curve; `AtlasRiseTests` asserts both.
struct AtlasRise {
    /// 0 the instant the first box leaves its plate, 1 once the last one has settled.
    float clock;
    /// How much of `clock` is spent staggering rather than climbing.
    float share;
    /// What a box's distance from the middle of the plan is divided by.
    float reach;
    /// The shallowest a file stands on this ground, which is where every box starts rather than
    /// at nothing: a roof on the exact plane of its own plate is two coplanar faces for the depth
    /// buffer to tear apart (`AtlasElevation.floorShare`).
    float floor;
};

/// The light, solved. `AtlasLighting` on the Swift side folds every lamp's direction and tint down
/// to these three numbers — camera-independent, because the two walls a fixed yaw ever shows never
/// change which lamp rakes across them — plus the wall's own contact term.
struct AtlasLighting {
    float roof;
    float nearX;
    float nearY;
    float contactFoot;
    /// The key's own direction ACROSS THE PLAN, normalised — which way a roof's sheen runs. The
    /// plan rather than the screen, so turning the map turns which side of a roof is bright, and
    /// so this is the same number every cast shadow is thrown along (`AtlasShadow.decal`).
    float2 keyPlan;
    /// How much of its own light the far side of a roof keeps: the roof's own `contactFoot`.
    float sheenFoot;
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
    /// The one scalar that varies ACROSS a face, NOT flat, because a gradient is the one thing
    /// here that has to interpolate. Two readings, one slot: up a wall it runs from `contactFoot`
    /// at the foot to its full share at the roof, and across a roof it runs from `sheenFoot` on
    /// the far side to its full share on the side the key comes from (#1600). Both are a scalar on
    /// the band's own pigment and both are affine in the model, so the rasteriser draws either one
    /// from the corners.
    float across;
    /// Which file this face belongs to, carried through untouched (#1153). Flat because an id is
    /// not a quantity: interpolating between two of them would name a third file at every pixel
    /// but the corners.
    uint id [[flat]];
};

/// What one fragment writes: the picture, and which file it is. TWO attachments of ONE pass, not
/// two passes — the id target cannot disagree with the screen because the same rasterisation, the
/// same depth test and the same fragment write both (#1153). A second pass would be a second
/// coverage rule, and every hit-test defect the prototype had was a second rule drifting from the
/// first.
struct AtlasWrite {
    float4 colour [[color(0)]];
    uint id [[color(1)]];
};

/// The floor's own numbers: the three stops of the graded ground, where the grade and the falloff
/// reach, the plane the floor lies on, and what the grain is spent at.
///
/// `AtlasGround` on the Swift side is the same fields in the same order; `AtlasFloorTests` asserts
/// the offsets, for the reason `AtlasVolumeTests` asserts the instance's.
struct AtlasGround {
    /// The drawable, in pixels. Every radius here is a SHARE of one of its sides, so the grade and
    /// the falloff are the same picture in a small window and a large one.
    float2 size;
    /// The middle stop: the ground where the lamp reaches it, at the middle of the plan.
    float3 lit;
    /// The dip, half way out.
    float3 deep;
    /// The desktop tone, which the grade returns to at the rim and the vignette lands on.
    float3 rim;
    /// How far out the grade runs, as a share of the drawable's LONGER side.
    float grade;
    /// Where the vignette starts, as a share of the shorter side, and where it lands, as a share
    /// of the longer.
    float2 falloff;
    /// The floor's own plane, in the plan's own points. Negative: it is under the plates.
    float drop;
    /// The weight the grain is spent at.
    float grain;
};

/// One patch of light laid on the floor: a plate's own light, or the contour grid.
///
/// The two are one primitive because they are one fact — light on the floor, bounded by the
/// vignette — and one instanced draw is what keeps them from needing a pipeline each. `divisions`
/// is the whole difference.
struct AtlasFloorPatch {
    /// Where the patch lies on the plan: origin, then size, in the plan's own points.
    float4 plan;
    /// What it is washed in: a pigment, and the weight it is spent at.
    float4 wash;
    /// 0 for a flat wash. Above 0 it is a contour grid at that many divisions of the patch's own
    /// span, which is what lets one quad carry a lattice instead of eighty-four lines.
    float divisions;
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

/// How much of its own height one box stands at, this frame (#1421).
///
/// The stagger runs on how far out from the middle of the plan the box sits, so the city opens
/// from its centre rather than sweeping across it, and the wave is a PLAN measurement: the same
/// box starts at the same point of the clock however the map is framed. The middle is
/// `eye.centre`, which IS the plan's own middle — a second one solved here would be a second
/// declaration of where the map's centre is.
///
/// Exactly 0 before a box's turn and exactly 1 after it, and ABOVE 1 in the last third of the
/// climb: the box passes its measured height and settles back onto it. That overshoot is a back
/// ease, and `AtlasRise.growth` in Swift is the same expression, term for term.
static float atlas_growth(AtlasVolume volume, constant AtlasEye &eye, constant AtlasRise &rise) {
    float2 middle = volume.origin + volume.size * 0.5;
    // How far the wave has to travel to reach this box: 0 at the middle of the plan and 1 at its
    // corner. `AtlasRise.wave` in Swift.
    float wave = min(1.0, length(middle - eye.centre) / rise.reach);
    float climb = 1.0 - rise.share;
    if (climb <= 0) {
        return rise.clock >= 1 ? 1 : 0;
    }
    float elapsed = (rise.clock - wave * rise.share) / climb;
    if (elapsed <= 0) {
        return 0;
    }
    if (elapsed >= 1) {
        return 1;
    }
    float overshoot = 1.15;
    float past = elapsed - 1;
    return 1 + (overshoot + 1) * past * past * past + overshoot * past * past;
}

/// The sheen across one roof: its full share on the side the key comes from, `sheenFoot` on the
/// far one (#1600).
///
/// A SCALAR, and affine in the plan, so the four corners carry it and the rasteriser draws the
/// gradient between them. The design solves the same thing as a screen-space linear gradient
/// between the two extreme corners (`cockpit-atlas.html`, `drawBox`), which is this expression once
/// the roof is projected. The size gate it puts on it — `rw > 16` — is a canvas cost rather than a
/// reading: a gradient object per box over fifteen hundred of them is the frame budget there, and
/// here it is four multiplies in a vertex stage that already ran.
static float atlas_sheen(float2 plan, float2 low, float2 high, constant AtlasLighting &lighting) {
    float2 key = lighting.keyPlan;
    // The plan corner the key reaches first, and the one it reaches last, picked off the SIGNS of
    // the direction — so the bright side follows the lamp rather than a corner fixed in here.
    float2 lit = select(low, high, key > 0);
    float2 far = select(high, low, key > 0);
    float reach = dot(key, lit - far);
    float along = reach > 0 ? saturate(dot(key, plan - far) / reach) : 1;
    return mix(lighting.sheenFoot, 1.0, along);
}

vertex AtlasFragment atlas_volume_vertex(
    uint vertex_id [[vertex_id]],
    uint volume_id [[instance_id]],
    const device AtlasVolume *volumes [[buffer(0)]],
    constant AtlasEye &eye [[buffer(1)]],
    constant AtlasLighting &lighting [[buffer(2)]],
    constant AtlasRise &rise [[buffer(3)]]
) {
    AtlasVolume volume = volumes[volume_id];
    float2 low = volume.origin;
    float2 high = volume.origin + volume.size;
    float foot = volume.heights.x;
    // The rise climbs the box's own height, from the map's floor rather than from nothing, so a
    // box with no height does not move: a plate's foot IS its roof, and a cast shadow's decal is
    // flat. Every box in the map goes through this one expression rather than being told which
    // kind it is — nothing here has to know. `AtlasRise.height` in Swift is the same expression.
    float growth = atlas_growth(volume, eye, rise);
    float base = min(rise.floor, volume.heights.y);
    float roof = base + (volume.heights.y - base) * growth;

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
    // The face's own scalar across itself, resolved to what the fragment multiplies in: a wall's
    // contact gradient, or a roof's sheen (#1600).
    float across;
    if (face == 0) {
        point = float3(mix(low.x, high.x, unit.x), mix(low.y, high.y, unit.y), roof);
        faceLight = lighting.roof;
        across = atlas_sheen(point.xy, low, high, lighting);
    } else if (face == 1) {
        point = float3(nearX, mix(low.y, high.y, unit.x), mix(foot, roof, unit.y));
        faceLight = lighting.nearX;
        across = mix(lighting.contactFoot, 1.0, unit.y);
    } else {
        point = float3(mix(low.x, high.x, unit.x), nearY, mix(foot, roof, unit.y));
        faceLight = lighting.nearY;
        across = mix(lighting.contactFoot, 1.0, unit.y);
    }

    AtlasFragment out;
    out.position = atlas_clip(point, eye);
    out.pigment = volume.pigment;
    // Both scalars this file ever multiplies onto a pigment run out to 1 as `relief` runs to 0:
    // the directional face light, because an unlit treemap has no faces to tell apart, and the
    // volume's own baked `shade`, because a shadow is a statement about height and the treemap
    // draws none.
    // The baked `shade` is also gated by the box's own growth, which is what keeps a cast shadow
    // from lying on the plate under a file that has not stood up yet: a shadow is a statement
    // about height, and a box at no height casts none. It costs an ordinary face nothing — their
    // `shade` is 1, and mixing 1 towards 1 is 1 at every point of the clock.
    out.light = mix(1.0, faceLight, eye.relief)
        * mix(1.0, volume.shade, eye.relief * saturate(growth));
    out.across = mix(1.0, across, eye.relief);
    out.id = volume.id;
    return out;
}

/// The grain, over one finished pixel: the design's own `overlay` fill at 0.05 (`rebuild`).
///
/// One 96-pixel tile of noise, read one texel a pixel. Large smooth gradients on a near-black
/// ground band in 8-bit, and the grain is what keeps them smooth.
///
/// **An overlay, not a multiply, and the difference is all on the lit roofs.** Below half
/// brightness the two are one expression to the last bit: overlay's dark branch composites to
/// `b * (1 + a * (2s - 1))`, which IS a multiply. Above it they part by `a * (2b - 1) * (1 - 2s)`,
/// up to 0.019 — five 8-bit steps — on the brightest channel this map draws. Overlay compresses
/// toward white and barely moves a lit roof; a multiply lifts it by its full 2.5%, and that margin
/// is the whole tolerance. A middling roof at its lit corner sits 0.135 from its legend swatch of
/// the 0.15 `ArgoLight.legendTolerance` allows; under a multiply it sits 0.163.
/// `AtlasLightingTests` is what holds that.
///
/// It is spent HERE, on each opaque surface's own finished colour, rather than in a pass over the
/// picture: the only blend Metal can be asked for is the multiply, and a pass that read the colour
/// attachment back is not portable. Every visible pixel is written by exactly one surface, so this
/// is the arithmetic a fill over the whole picture would do.
static float3 atlas_grain(
    float3 colour,
    float2 pixel,
    constant AtlasGround &ground,
    texture2d<float, access::read> grain
) {
    uint2 at = uint2(pixel) % uint2(grain.get_width(), grain.get_height());
    float noise = grain.read(at).x;
    float3 dark = 2.0 * colour * noise;
    float3 light = 1.0 - 2.0 * (1.0 - colour) * (1.0 - noise);
    return mix(colour, select(light, dark, colour < 0.5), ground.grain);
}

fragment AtlasWrite atlas_volume_fragment(
    AtlasFragment in [[stage_in]],
    constant AtlasGround &ground [[buffer(0)]],
    texture2d<float, access::read> grain [[texture(0)]]
) {
    float3 lit = in.pigment * in.light * in.across;
    return AtlasWrite {
        float4(atlas_grain(lit, in.position.xy, ground, grain), 1),
        in.id
    };
}

// ---------- the floor, the vignette and the grain (#1600) ----------
//
// The city is a lit diorama on a graded table, and this is the table: the graded ground with its
// vignette, and the light laid on the floor — the plates' own and the contour grid. Both are
// encoded into the SAME render pass the boxes are, before them. The grain is not a pass at all;
// `atlas_grain` below says where it is spent and why.
//
// `AtlasGround`, `AtlasFloorPatch` and `atlas_grain` are declared with the other structs above
// rather than here, because the BOXES' own fragment stage reads all three and Metal has no forward
// declarations.
//
// NOTHING HERE IS GATED ON `relief`. The floor is a real plane at `drop` under the plates and
// `atlas_clip` already scales every height by `relief`, so the plane rises onto the plan of its own
// accord as the camera goes flat — the treemap then shows the grid in the ring outside the plates
// and nothing under them, which is the picture the design draws.

struct AtlasGroundFragment {
    float4 position [[position]];
    /// Where the middle of the plan lands on the floor's plane, in pixels — the centre the grade
    /// and the vignette are both measured from. Solved in the vertex stage through `atlas_clip`,
    /// so nothing here is a second declaration of the projection.
    float2 middle [[flat]];
};

struct AtlasFloorFragment {
    float4 position [[position]];
    /// Where this pixel sits across the patch, 0 to 1 on each axis. Perspective-correct, which is
    /// what lets the lattice be solved in the fragment stage rather than drawn as geometry.
    float2 unit;
    float2 middle [[flat]];
    float4 wash [[flat]];
    float divisions [[flat]];
};

/// The whole drawable, as one quad in clip space.
static float4 atlas_screen(uint vertex_id) {
    return float4(atlas_quad[vertex_id] * 2.0 - 1.0, 0, 1);
}

/// Where the middle of the plan lands on the floor's own plane, in pixels of the drawable.
static float2 atlas_floor_middle(constant AtlasEye &eye, constant AtlasGround &ground) {
    float4 clip = atlas_clip(float3(eye.centre, ground.drop), eye);
    float2 plane = clip.xy / clip.w;
    // Clip counts y UP from the middle and the framebuffer counts it DOWN from the top.
    return (float2(plane.x, -plane.y) * 0.5 + 0.5) * ground.size;
}

/// How far the vignette has taken one pixel toward the ground tone: 0 inside the table, 1 at its
/// rim. The far floor has to go out somewhere, and a hard edge reads as a table top — so the
/// picture has an edge instead of running to the frame.
///
/// Anything that lights the floor LATER is bounded by the same falloff, or it lights nothing. The
/// design fills the vignette over the grid and the plates' light; the pass below spends `1 - this`
/// on its own weight instead, which is the same arithmetic one multiply earlier and leaves the
/// ground tone at the rim short by at most 0.2/255.
static float atlas_vignette(float2 pixel, float2 middle, constant AtlasGround &ground) {
    float inner = min(ground.size.x, ground.size.y) * ground.falloff.x;
    float outer = max(ground.size.x, ground.size.y) * ground.falloff.y;
    return saturate((length(pixel - middle) - inner) / max(outer - inner, 1.0));
}

vertex AtlasGroundFragment atlas_ground_vertex(
    uint vertex_id [[vertex_id]],
    constant AtlasEye &eye [[buffer(1)]],
    constant AtlasGround &ground [[buffer(4)]]
) {
    AtlasGroundFragment out;
    out.position = atlas_screen(vertex_id);
    out.middle = atlas_floor_middle(eye, ground);
    return out;
}

/// The graded ground and its vignette, in one fill.
///
/// The grade runs from the lamp landing at the middle of the plan, through the dip half way out,
/// back to the desktop tone at the corners — so the picture has a centre of attention rather than
/// an even field. The vignette takes the same middle and lands on the same tone.
///
/// The vignette is a lerp toward that tone rather than the design's own gradient, whose first stop
/// is a slightly darker colour at ZERO alpha (`vignette`). Interpolating a colour nothing is spent
/// at moves the middle of the ramp by at most 1.7/255 in red, which is under the 8-bit step the
/// grain below exists to break up.
fragment float4 atlas_ground_fragment(
    AtlasGroundFragment in [[stage_in]],
    constant AtlasGround &ground [[buffer(0)]],
    texture2d<float, access::read> grain [[texture(0)]]
) {
    float reach = max(max(ground.size.x, ground.size.y) * ground.grade, 1.0);
    float out = saturate(length(in.position.xy - in.middle) / reach);
    float3 graded = out < 0.5
        ? mix(ground.lit, ground.deep, out * 2.0)
        : mix(ground.deep, ground.rim, (out - 0.5) * 2.0);
    float3 table = mix(graded, ground.rim, atlas_vignette(in.position.xy, in.middle, ground));
    return float4(atlas_grain(table, in.position.xy, ground, grain), 1);
}

vertex AtlasFloorFragment atlas_floor_vertex(
    uint vertex_id [[vertex_id]],
    uint patch_id [[instance_id]],
    const device AtlasFloorPatch *patches [[buffer(0)]],
    constant AtlasEye &eye [[buffer(1)]],
    constant AtlasGround &ground [[buffer(4)]]
) {
    AtlasFloorPatch patch = patches[patch_id];
    float2 unit = atlas_quad[vertex_id];
    AtlasFloorFragment out;
    out.position = atlas_clip(float3(patch.plan.xy + patch.plan.zw * unit, ground.drop), eye);
    out.unit = unit;
    out.middle = atlas_floor_middle(eye, ground);
    out.wash = patch.wash;
    out.divisions = patch.divisions;
    return out;
}

/// How much of one pixel a contour line covers, at a lattice of `divisions` across the patch.
///
/// Solved from the plan coordinate and its own screen-space derivative rather than stroked as
/// geometry: a line one PIXEL wide however far away the floor recedes, antialiased, and no
/// eighty-four segments to expand. `1 - distance / width` is exactly a one-pixel line — the
/// distance to the nearest lattice line, in pixels.
///
/// It fades with its own spacing, which the design has no need of and a receding plane does: past
/// the point where two lines are under two pixels apart the lattice is not a grid any more, it is
/// moiré. Fading the weight out is what a mip map would do for a drawn one.
static float atlas_grid(float2 unit, float divisions) {
    float2 width = max(fwidth(unit), 1e-6);
    float2 apart = abs(fract(unit * divisions + 0.5) - 0.5) / divisions;
    float2 cover = saturate(1.0 - apart / width);
    float2 fade = saturate((1.0 / divisions) / (width * 2.0));
    return max(cover.x * fade.x, cover.y * fade.y);
}

/// One patch of the floor's light, PREMULTIPLIED — the blend is `one, oneMinusSourceAlpha`, so a
/// weight that has already been spent on the pigment cannot be spent on it twice.
///
/// The plates' light stacks by construction: two patches over one pixel composite, so a deeply
/// nested corner of the repository sits over more plates than a shallow one and comes out brighter
/// for it, with nothing here counting depth.
fragment float4 atlas_floor_fragment(
    AtlasFloorFragment in [[stage_in]],
    constant AtlasGround &ground [[buffer(0)]]
) {
    // No grain here: a patch is blended over ground that already carries it, and dithering the
    // wash as well would only weaken what is under it by the patch's own weight.
    float cover = in.divisions > 0 ? atlas_grid(in.unit, in.divisions) : 1;
    float weight = in.wash.w * cover
        * (1.0 - atlas_vignette(in.position.xy, in.middle, ground));
    return float4(in.wash.xyz * weight, weight);
}

/// ONE SAMPLE OF THE ID TARGET, CHOSEN — never averaged (#1153, under #1400's multisampling).
///
/// Metal cannot resolve an integer attachment, and that restriction is the right one: a resolve
/// AVERAGES, and the average of two file ids is a third file. So this picks instead of blending,
/// and what it picks is the first sample carrying a box. Every sample at a pixel is a box the one
/// rasterisation genuinely covered that pixel with, so at an edge the reader is told one of the
/// boxes that are really there — which is the honest answer and the only one a pixel has room for.
///
/// A box beats no box, rather than sample 0 winning by position. A file one sample wide is a file
/// on the screen, and the reader pointing at it is owed its name rather than the ground behind it.
kernel void atlas_id_resolve(
    texture2d_ms<uint, access::read> samples [[texture(0)]],
    texture2d<uint, access::write> resolved [[texture(1)]],
    uint2 at [[thread_position_in_grid]]
) {
    if (at.x >= resolved.get_width() || at.y >= resolved.get_height()) {
        return;
    }
    uint id = 0;
    for (uint sample = 0; sample < samples.get_num_samples(); ++sample) {
        uint found = samples.read(at, sample).x;
        if (found != 0) {
            id = found;
            break;
        }
    }
    resolved.write(uint4(id, 0, 0, 0), at);
}
