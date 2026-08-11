import SwiftUI

/// The line under the header: the deck's tabs, and on its trailing edge what the Session has spent
/// and how long it has been going.
///
/// The spend sits HERE rather than beside the title, which carries the identity and one instrument
/// (D31, as #502 amended it).
///
/// The tabs themselves are still a placeholder (#401–#404), and it is the slot that takes the
/// slack so the spend keeps its own edge.
struct SessionTabLine: View {
    @Environment(\.argo) private var argo

    /// Already composed by the projection. Absent for a Session none of it could be read from, and
    /// the line then carries the tabs alone.
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
/// reported — which is every Session today.
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
