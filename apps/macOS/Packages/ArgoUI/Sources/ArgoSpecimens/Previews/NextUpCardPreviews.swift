import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("Next-up hero — the four tiers") {
    VStack(alignment: .leading, spacing: ArgoSpacing.base) {
        NextUpCard(nextUp: TicketsFixture.room.nextUp ?? .backlogClear)
        NextUpCard(nextUp: .nothingUnblocked)
        NextUpCard(nextUp: .allRunning)
        NextUpCard(nextUp: .backlogClear)
    }
    .frame(width: ArgoLayout.sidebarMinimumWidth)
    .argoAppearance()
}
