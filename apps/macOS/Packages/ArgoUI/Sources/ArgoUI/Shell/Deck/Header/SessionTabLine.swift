import SwiftUI

/// The line under the header: the deck's tabs, and nothing else since the telemetry left it for the
/// titlebar title's hover (#692).
///
/// The tabs themselves are still a placeholder (#401–#404). The line keeps its height regardless —
/// every zone below the canopy is inset by it.
struct SessionTabLine: View {
    var body: some View {
        HStack(spacing: ArgoSpacing.comfortable) {
            DeckSlot(zone: .tabs)
        }
        .padding(.horizontal, ArgoSpacing.section)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview("Tab line — the tabs alone, at the narrowest deck the window allows") {
    SessionTabLine()
        .frame(
            width: ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth,
            height: ArgoLayout.deckTabSlotHeight,
        )
        .argoDeckSurface()
        .argoAppearance()
}
