import ArgoDesign
import SwiftUI

/// The hero starter AS a control (#899): its own vessel, on the card's own ground.
///
/// It cannot borrow `.quiet`'s flat `surface.overlay`. That fill is a fixed ink, and the card under
/// it is not — measured on the render, it went invisible against `surface.hover` and came out
/// DARKER than `surface.selected`, in the two states the starter most has to read as a target of
/// its own. So the vessel carries an `edge.subtle` rim, which separates it from the card in all
/// three of the card's grounds, and answers the pointer on its own account.
struct NextUpStarterStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        Vessel(isPressed: configuration.isPressed, label: configuration.label)
    }

    /// A nested `View`, for `NextUpCardStyle.Card`'s reason: a `ButtonStyle` holds no `@State`.
    private struct Vessel: View {
        @Environment(\.argo) private var argo
        @Environment(\.nextUpStillsStarter) private var still

        let isPressed: Bool
        let label: ButtonStyleConfiguration.Label

        @State private var isHovered = false

        var body: some View {
            label
                .padding(.horizontal, ArgoSpacing.base)
                .padding(.vertical, ArgoSpacing.tight)
                .background { ground }
                .overlay {
                    RoundedRectangle(cornerRadius: ArgoRadius.control)
                        .strokeBorder(rim, lineWidth: ArgoStroke.border)
                }
                .contentShape(.rect(cornerRadius: ArgoRadius.control))
                .onHover { isHovered = $0 }
        }

        private var pointer: NextUpCardStyle.Pointer {
            if let still {
                return still
            }
            if isPressed {
                return .down
            }
            return isHovered ? .over : .away
        }

        /// `surface.overlay` ALWAYS, with the wash over it rather than in place of it — the rule
        /// `NextUpCardGround` already had to learn. The contract's hover and pressed roles are
        /// TRANSLUCENT whites meant to be composited onto a ground; used as the fill they landed
        /// within 3 of the card beneath, so a pointer on the starter was pixel-identical to no
        /// pointer at all.
        private var ground: some View {
            RoundedRectangle(cornerRadius: ArgoRadius.control)
                .fill(argo.color.surface.overlay)
                .overlay {
                    RoundedRectangle(cornerRadius: ArgoRadius.control).fill(wash)
                }
        }

        private var wash: ArgoColor {
            switch pointer {
            case .away: .transparent
            case .over: argo.color.surface.hover
            case .down: argo.color.surface.selected
            }
        }

        private var rim: ArgoColor {
            pointer == .down ? argo.color.edge.strong : argo.color.edge.subtle
        }
    }
}

extension EnvironmentValues {
    /// The STARTER's own pointer state, forced for a render — `nextUpStillsPointer`'s sibling, and
    /// separate from it so one frame can show a card at rest under a starter being pressed. That
    /// pair is the only evidence a still render can give that the two are separate targets.
    @Entry var nextUpStillsStarter: NextUpCardStyle.Pointer?
}
