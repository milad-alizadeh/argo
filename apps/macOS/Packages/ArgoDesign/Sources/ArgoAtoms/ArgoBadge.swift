import ArgoDesign
import SwiftUI

/// A count carried on a control: how many of something is waiting behind it.
///
/// It takes no hue — a badge marks a KIND of fact, not one of the four operational states — so it
/// is a ground off the neutral ramp (`overlay`) with the loudest neutral ink on it. A capsule and
/// not a circle, so a number is never cut to fit; one digit still reads as a disc, because the
/// capsule's minimum width is its height.
public struct ArgoBadge: View {
    @Environment(\.argo) private var argo

    /// The type the number is set in. Monospaced: a number that changes while the reader watches
    /// re-measures the chip around it in a proportional face.
    public static let type = ArgoTypography.machineCaption
    /// Either side of the number, so two and three digits stay a chip.
    public static let insetX: CGFloat = ArgoSpacing.tight
    /// Above and below it — the type-setter's line box already stands clear of the glyphs.
    public static let insetY: CGFloat = ArgoSpacing.hair

    /// One line of that type plus the inset either side, DERIVED rather than sampled: a number
    /// written down here goes wrong the moment the type role under it moves.
    public static var height: CGFloat {
        insetY * 2 + type.nominalLineBox.rounded(.up)
    }

    let count: Int

    public init(count: Int) {
        self.count = count
    }

    public var body: some View {
        Text("\(count)")
            .argoText(Self.type)
            .foregroundStyle(argo.color.text.primary)
            .padding(.horizontal, Self.insetX)
            .frame(minWidth: Self.height, minHeight: Self.height)
            .background(argo.color.surface.overlay, in: .capsule)
            // Holds the chip off whatever it is laid on — including a glass vessel, where the
            // ground alone refracts into the material and the boundary stops being one.
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
