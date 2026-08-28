import SwiftUI

extension View {
    /// The Next-up card's own shape: its inner padding, a fill, and a border at
    /// `ArgoRadius.control` — three things a `ViewRow` has none of, which is what stops the hero
    /// reading as another view (`cockpit-work-room.md` — the Next-up hero).
    ///
    /// The pointer is the caller's, because the card is drawn at rest for a degraded tier and lit
    /// under the pointer by `NextUpCardStyle`. One shape either way, so the control and the
    /// sentence cannot come apart.
    func nextUpCardGround(_ pointer: NextUpCardStyle.Pointer = .away) -> some View {
        modifier(NextUpCardGround(pointer: pointer))
    }
}

/// A modifier and not a stack at each site: a `ButtonStyle` cannot share a private view of the card
/// it is styling.
private struct NextUpCardGround: ViewModifier {
    @Environment(\.argo) private var argo

    let pointer: NextUpCardStyle.Pointer

    func body(content: Content) -> some View {
        content
            .padding(ArgoTicketsSidebar.heroPadding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background { ground }
            .overlay { rim }
    }

    /// `surface.raised` ALWAYS, with the wash laid OVER it rather than in place of it. The
    /// contract's hover and pressed roles are translucent whites: a card that swapped its fill for
    /// one rendered lighter than the rail it is inset in and stopped reading as raised at all.
    private var ground: some View {
        RoundedRectangle(cornerRadius: ArgoRadius.control)
            .fill(argo.color.surface.raised)
            .overlay {
                RoundedRectangle(cornerRadius: ArgoRadius.control).fill(wash)
            }
    }

    /// The border carries the PRESS. Measured on the render, the two washes the contract names for
    /// hover and pressed land three levels apart over this ground — a step the eye does not read.
    /// `edge.strong` against `edge.subtle` is the one that does, and it costs no new token.
    private var rim: some View {
        RoundedRectangle(cornerRadius: ArgoRadius.control)
            .strokeBorder(edge, lineWidth: ArgoStroke.border)
    }

    private var wash: ArgoColor {
        switch pointer {
        case .away: .transparent
        case .over: argo.color.surface.hover
        case .down: argo.color.surface.selected
        }
    }

    private var edge: ArgoColor {
        pointer == .down ? argo.color.edge.strong : argo.color.edge.subtle
    }
}
