import SwiftUI

/// One priority band's header over the backlog's roots (#819) — the word, and how many rows stand
/// under it.
///
/// The count is of the rows the band DRAWS, so folding a parent lowers it. A subtree count would
/// stand over one visible row and read as a lie; the parent's own `n/m` roll-up already says how
/// many children it has (`cockpit-work-room.md`).
struct PriorityHeader: View {
    @Environment(\.argo) private var argo

    let band: TicketsRoomProjection.Band
    /// The length of the array the list drew for this band — passed rather than derived, so the
    /// header and the rows under it cannot be counting two different things.
    let count: Int

    var body: some View {
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
}

#Preview("Priority headers — the three bands, and the one nobody read") {
    let roots = TicketsFixture.room.backlog

    VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
        ForEach(TicketsRoomProjection.bands(of: roots)) { band in
            PriorityHeader(band: band, count: TicketsRoomProjection.drawn(band, shut: []).count)
        }
        PriorityHeader(band: TicketsRoomProjection.Band(priority: nil, roots: []), count: 0)
    }
    .frame(width: ArgoBacklogList.width, alignment: .leading)
    .argoDeckSurface()
    .argoAppearance()
}
