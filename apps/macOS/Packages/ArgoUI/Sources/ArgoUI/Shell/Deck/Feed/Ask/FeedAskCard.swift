import SwiftUI

/// The ground and edge every pressable thing in a waiting ask row stands on — an option, and the
/// `Other…` beside it.
///
/// One owner, because the two would otherwise spell the same three roles twice and drift the first
/// time one of them is retuned. Hover is a second LAYER over the control's ground rather than a
/// third opacity standing in for the pair; ticked is the two rungs below the `muted` the card
/// itself wears.
struct FeedAskCard: ViewModifier {
    @Environment(\.argo) private var argo

    let isHovered: Bool
    /// Only an option can be ticked; `Other…` passes `false` and never draws the marked state.
    var isTicked = false

    func body(content: Content) -> some View {
        content
            .background { ground }
            .overlay { shape.strokeBorder(edge, lineWidth: ArgoStroke.border) }
    }

    private var shape: RoundedRectangle {
        RoundedRectangle(cornerRadius: ArgoRadius.control)
    }

    /// `surface.control` is "the ground under a control on a surface which is not the deck" — the
    /// role's own words.
    private var ground: some View {
        ZStack {
            shape.fill(argo.color.surface.control.color)
            if isHovered {
                shape.fill(argo.color.surface.hover.color)
            }
            if isTicked {
                shape.fill(argo.color.state.wash(argo.color.state.attention).color)
            }
        }
    }

    private var edge: ArgoColor {
        if isTicked {
            return argo.color.state.rim(argo.color.state.attention)
        }
        return isHovered ? argo.color.edge.subtle : argo.color.edge.hairline
    }
}

extension View {
    func feedAskCard(isHovered: Bool, isTicked: Bool = false) -> some View {
        modifier(FeedAskCard(isHovered: isHovered, isTicked: isTicked))
    }
}
