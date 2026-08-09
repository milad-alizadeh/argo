import SwiftUI

/// A count carried on a control: how many of something is waiting behind it.
///
/// The contract's first badge, and a primitive rather than a decoration inside the one control that
/// needed it — a number stuck on the corner of a button is a shape every surface eventually wants,
/// and the second one drawn by hand is where two of them stop agreeing.
///
/// It takes no hue. A badge marks a KIND of fact rather than one of the four operational states,
/// and this palette rations hue for meaning: what makes the chip findable is a ground off the
/// neutral ramp — `overlay`, the step that sits above every surface a float can land on — with the
/// loudest rung of the neutral ink on it. Ion Blue is brand, selection and focus, and a count is
/// none of the three.
///
/// A capsule and not a circle, so a number is never cut to fit its own container. One digit still
/// reads as a disc, because the capsule's minimum width is its height.
struct ArgoBadge: View {
    @Environment(\.argo) private var argo

    /// The type the number is set in. Monospaced for the reason the plan pill's counter is: a
    /// number that changes while the reader watches it re-measures the chip around it in a
    /// proportional face, which is a control twitching once per arriving line.
    static let type = ArgoTypography.machineCaption
    /// Either side of the number, so two and three digits are a chip rather than a box jammed
    /// against its own glyphs.
    static let insetX: CGFloat = ArgoSpacing.tight
    /// Above and below it — the tightest step in the rhythm, because the type-setter's line box
    /// already stands clear of the glyphs and anything more makes a lozenge of a badge.
    static let insetY: CGFloat = ArgoSpacing.hair

    /// One line of that type plus the inset either side, DERIVED rather than sampled for the reason
    /// `ArgoPlanPill.laneHeight` is: the height follows the rung, and a number written down here
    /// goes wrong the moment the type role under it moves.
    static var height: CGFloat {
        insetY * 2 + type.lineBox.rounded(.up)
    }

    let count: Int

    var body: some View {
        Text("\(count)")
            .argoText(Self.type)
            .foregroundStyle(argo.color.text.primary)
            .padding(.horizontal, Self.insetX)
            .frame(minWidth: Self.height, minHeight: Self.height)
            .background(argo.color.surface.overlay, in: .capsule)
            // The rim the rest of the contract builds depth from. It is what holds the chip off
            // whatever it is laid on — including a glass vessel, where the ground alone refracts
            // into the material and the boundary between the two stops being a boundary.
            .overlay {
                Capsule().strokeBorder(argo.color.edge.subtle, lineWidth: ArgoStroke.border)
            }
    }
}

#Preview("Badge — one digit, two, and three") {
    HStack(spacing: ArgoSpacing.comfortable) {
        ArgoBadge(count: 1)
        ArgoBadge(count: 12)
        ArgoBadge(count: 247)
    }
    .padding(ArgoSpacing.region)
    .argoDeckSurface()
    .argoAppearance()
}
