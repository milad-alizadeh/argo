import ArgoAtoms
import ArgoDesign
import SwiftUI

/// One priority band's header over the backlog's roots (#819) — the word, and how many rows stand
/// under it.
///
/// The count is of the rows the band DRAWS, so folding a parent lowers it. A subtree count would
/// stand over one visible row and read as a lie; the parent's own `n/m` roll-up already says how
/// many children it has (`cockpit-work-room.md`).
package struct PriorityHeader: View {
    @Environment(\.argo) private var argo

    let band: TicketsRoomProjection.Band
    /// The length of the array the list drew for this band — passed rather than derived, so the
    /// header and the rows under it cannot be counting two different things.
    let count: Int

    package var body: some View {
        HStack(spacing: ArgoSpacing.snug) {
            GroupLabel(band.label)
            Spacer(minLength: ArgoSpacing.snug)
            Text(String(count))
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.disabled)
        }
        .padding(.horizontal, ArgoBacklogList.gutter)
        .padding(.top, ArgoSpacing.comfortable)
        .padding(.bottom, ArgoSpacing.tight)
        .accessibilityElement(children: .combine)
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(band: TicketsRoomProjection.Band, count: Int) {
        self.band = band
        self.count = count
    }
}
