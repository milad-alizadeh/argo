import SwiftUI

/// The line under the header: the deck's tabs, and on its trailing edge what the Session has spent
/// and how long it has been going.
///
/// The spend sits HERE rather than beside the title because the header carries the Session's
/// identity and one instrument, and a second reading beside the first would be two numbers
/// competing at the top of the plane. This overturns D31, which banished token counts to an
/// inspection popover — a fact worth acting on is worth being on screen.
///
/// The tabs themselves are still a placeholder (#401–#404). It is the slot that takes the slack, so
/// the spend keeps its own edge on the day something real fills the zone.
struct SessionTabLine: View {
    @Environment(\.argo) private var argo

    /// Already composed by the projection. Absent for a Session none of it could be read from —
    /// the line then carries the tabs alone rather than an apology for a number.
    let spend: String?

    var body: some View {
        HStack(spacing: ArgoSpacing.comfortable) {
            DeckSlot(zone: .tabs)
            if let spend {
                Text(spend)
                    .argoText(ArgoTypography.caption)
                    .foregroundStyle(argo.color.text.tertiary)
                    .lineLimit(1)
                    // The tabs give way first: the spend is a fixed run of short facts, and a
                    // truncated `worked 1h 13m` would be a duration nobody can read.
                    .layoutPriority(1)
            }
        }
        .padding(.horizontal, ArgoSpacing.section)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// The line as a Session with everything reported sees it, and as one whose subagent spend nobody
/// reported — which is every Session today. The pair is the render: what has to be true is that the
/// shorter line reads as complete rather than as one with a fact missing out of it.
private struct SessionTabLineGallery: View {
    let width: CGFloat

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            ForEach(Array(SessionSpendFixture.headers.enumerated()), id: \.offset) { _, header in
                SessionTabLine(spend: header.spend)
                    .frame(height: ArgoLayout.deckTabSlotHeight)
            }
            SessionTabLine(spend: nil)
                .frame(height: ArgoLayout.deckTabSlotHeight)
        }
        .frame(width: width)
        .argoDeckSurface()
        .argoAppearance()
    }
}

#Preview("Tab line — the full line, the line without subagents, and no reading at all") {
    SessionTabLineGallery(width: 900)
}

#Preview("Tab line — at the narrowest deck the window allows") {
    SessionTabLineGallery(width: ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth)
}
