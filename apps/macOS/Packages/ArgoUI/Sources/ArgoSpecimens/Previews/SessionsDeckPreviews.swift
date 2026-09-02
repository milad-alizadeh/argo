import ArgoDesign
import ArgoEngine
import ArgoUI
import SwiftUI

#Preview("Sessions deck — zones") {
    SessionsDeck(
        feed: FeedProjection.previewRows,
        header: SessionHeaderFixture.header(for: .managed),
        showing: PlanShowing(plan: PlanProjection.previewReading),
    )
    .frame(width: 900, height: 620)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Sessions deck — a call's evidence open beside the feed") {
    SessionsDeck(
        feed: FeedProjection.previewRows,
        open: .constant(FeedProjection.previewFailedCallID),
    )
    .frame(width: 900, height: 620)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Sessions deck — the plan's list open over the feed") {
    SessionsDeck(
        feed: FeedProjection.previewRows,
        showing: PlanShowing(plan: PlanFixture.working, isRevealed: true),
    )
    .frame(width: 900, height: 620)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Sessions deck — narrowest deck the window allows") {
    SessionsDeck(feed: FeedProjection.previewRows)
        .frame(
            width: ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth,
            height: ArgoLayout.windowMinimumHeight,
        )
        .argoDeckSurface()
        .argoAppearance()
}
