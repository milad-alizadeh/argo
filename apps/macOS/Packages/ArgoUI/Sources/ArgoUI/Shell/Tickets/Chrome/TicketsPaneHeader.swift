import ArgoAtoms
import ArgoDesign
import SwiftUI

/// One pane's own header — the band a pane draws for the controls that act on IT
/// (`cockpit-work-room.md`, #1242).
///
/// **It is drawn IN the window's title strip, not under it.** That is the whole difference between
/// this and #836's `TicketBand`, which declared 44 and opened below the strip: two panes each lost
/// a line, in a room that can least spare one. `reach` is the safe-area inset the deck measures at
/// the window's top edge — the same number `DeckCanopy` climbs by — and the band takes exactly
/// that, so the strip is spent once and no pane pays for it twice. **Nothing here may name a
/// height in its place**: a constant cannot be the system's strip, and the moment one is written
/// down as the band this has become #836 again.
///
/// **Controls sit at the pane's own leading edge and a field at its trailing one**, on the pane's
/// own column inset. That is the rule the room states, and it is what makes the ticket's verbs land
/// over the ticket at every window width BY CONSTRUCTION — rather than by arithmetic between the
/// window's trailing edge and a seam the reader can drag, which is the measurement #1242 is about.
///
/// **No rule at its foot.** The panes are glass containers and a container's own edge is what
/// separates the band from the reading under it; a hairline here would stack a second edge inside
/// the material's, which is what `ArgoElevation.vessel` already refuses on the outside.
package struct TicketsPaneHeader<Leading: View, Trailing: View>: View {
    /// How far the band climbs past the safe area — the window's own strip, measured by the deck
    /// and handed down. Zero where there is no strip over this pane, which is a specimen or a
    /// preview; the floor below is what draws the band there.
    var reach: CGFloat = 0
    /// The pane's own column inset, so the header starts where the pane's content starts. A
    /// control carrying its own container is judged by the CONTAINER's edge; the mark inside sits
    /// inboard by the vessel's inset, which is the vessel's business.
    let inset: CGFloat
    @ViewBuilder let leading: Leading
    @ViewBuilder let trailing: Trailing

    /// What the band cannot go below: a control of its own, and air either side of it. DERIVED
    /// from the control it holds rather than written down, and it is a FLOOR and not the band —
    /// the band is `reach`. It is reached only where there is no strip to reach into, so a
    /// preview and a specimen draw the header rather than collapsing it to nothing.
    private static var floor: CGFloat {
        ArgoControlBox.vessel + ArgoSpacing.base * 2
    }

    package var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            leading
            Spacer(minLength: ArgoSpacing.base)
            trailing
        }
        .padding(.horizontal, inset)
        .frame(maxWidth: .infinity, minHeight: max(reach, Self.floor), alignment: .leading)
        .argoChromeBar()
        .ignoresSafeArea(.container, edges: .top)
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal`, and the specimens
    /// build this from their own target (#1085). In the type's BODY and not an extension — an
    /// extension does not suppress the synthesised one, and the two then collide.
    package init(
        reach: CGFloat = 0,
        inset: CGFloat,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing,
    ) {
        self.reach = reach
        self.inset = inset
        self.leading = leading()
        self.trailing = trailing()
    }
}

package extension TicketsPaneHeader where Trailing == EmptyView {
    /// A header whose pane has one slot — the ticket's, which carries its verbs at the leading
    /// edge and nothing at the trailing one.
    init(reach: CGFloat = 0, inset: CGFloat, @ViewBuilder leading: () -> Leading) {
        self.init(reach: reach, inset: inset, leading: leading, trailing: { EmptyView() })
    }
}
