import ArgoDesign
import AtlasLayout
import SwiftUI

/// The handle itself, drawn: the design's own `#orbc`, a 54-point lit sphere with the city's plan
/// turning inside it — not an icon of one (`docs/designs/cockpit-atlas.html`).
///
/// A READOUT as much as a handle, which is why it takes the orientation rather than the gestures:
/// a reset, a key press and a drag all move it without any of them knowing it exists.
struct AtlasOrbitBall: View {
    /// What the reader has turned the model to. Everything below is a function of it.
    let orientation: AtlasOrientation
    /// The ball's own pigment — the map's `unassigned` neutral, so the handle claims no band.
    let pigment: ArgoColor
    /// The ink the plan square is drawn in.
    let plan: ArgoColor

    /// The design's own diameter, and larger than any control box in the app on purpose: a drag
    /// target has to be found by the thumb without first being read.
    static let diameter: CGFloat = 54

    /// How many pixels a point is shaded at. Fixed rather than read off the display, because the
    /// disc is redrawn on every frame of a drag and a 4× buffer buys nothing a feathered rim at 2×
    /// does not already give.
    private static let pixelScale: CGFloat = 2
    /// The plan square's own rule, one point wide — the design draws it at one CSS pixel.
    private static let rule: CGFloat = 1
    /// How far in front of the ball's centre a corner has to sit to be drawn as the near one.
    private static let depthSpan = 2.84
    private static let depthOrigin = 1.42
    /// What the plan's far edge is left at, and how much more the near one is given. Not tokens:
    /// this is one widget's own readout of depth, the way `AtlasLight.contactFoot` is the wall's —
    /// a wash a surface elsewhere could reuse would be saying something else with the same number.
    private static let farEdge = 0.07
    private static let edgeRange = 0.62
    /// The fixed corner's mark, in front of the ball and behind it.
    private static let markNear = 0.92
    private static let markFar = 0.26
    /// The mark's own radius, as a multiple of the rule it sits on.
    private static let markShare: CGFloat = 1.8

    var body: some View {
        Canvas(rendersAsynchronously: false) { context, size in
            let shading = AtlasOrbitShading(orientation: orientation, pigment: pigment)
            let pixels = Int(size.width * Self.pixelScale)
            if let ball = shading.ball(diameter: pixels) {
                context.draw(
                    Image(decorative: ball, scale: Self.pixelScale),
                    in: CGRect(origin: .zero, size: size),
                )
            }
            draw(shading.planCorners(radius: size.width / 2), into: context)
        }
        .frame(width: Self.diameter, height: Self.diameter)
    }

    /// The plan, through the ball. The near edges are the bright ones and one fixed corner carries
    /// a dot, because a square is its own quarter-turn — without the mark, a half-turn of the city
    /// would move nothing the reader could see.
    private func draw(_ corners: [(point: CGPoint, depth: Double)], into context: GraphicsContext) {
        for index in corners.indices {
            let from = corners[index], to = corners[(index + 1) % corners.count]
            var edge = Path()
            edge.move(to: from.point)
            edge.addLine(to: to.point)
            let near = nearness(of: (from.depth + to.depth) / 2)
            context.stroke(
                edge,
                with: .color(plan.opacity(Self.farEdge + Self.edgeRange * near).color),
                lineWidth: Self.rule,
            )
        }
        guard let mark = corners.first else { return }
        let dot = Self.rule * Self.markShare
        context.fill(
            Path(ellipseIn: CGRect(
                x: mark.point.x - dot, y: mark.point.y - dot, width: dot * 2, height: dot * 2,
            )),
            with: .color(plan.opacity(mark.depth > 0 ? Self.markNear : Self.markFar).color),
        )
    }

    /// How far toward the reader a depth sits, 0 to 1 — the whole span a unit square's corner can
    /// reach at any orientation, so the brightest edge is the near one at every turn.
    private func nearness(of depth: Double) -> Double {
        min(1, max(0, (depth + Self.depthOrigin) / Self.depthSpan))
    }
}

#Preview("Atlas orbit ball — the opening view, and turned") {
    HStack(spacing: ArgoSpacing.comfortable) {
        ForEach([0.0, 0.6, 1.2], id: \.self) { turn in
            AtlasOrbitBall(
                orientation: AtlasOrientation.opening.turned(yaw: turn, pitch: 0),
                pigment: ArgoTheme.graphite.color.atlas.materials.unassigned,
                plan: ArgoTheme.graphite.color.interaction.accentBright,
            )
        }
    }
    .padding(ArgoSpacing.region)
    .argoDeckSurface()
    .argoAppearance()
}
