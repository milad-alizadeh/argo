import ArgoDesign
import ArgoEngine
import ArgoUI
import SwiftUI

#Preview("Port row — bound, and re-bindable") {
    ConnectPortRow(
        row: ConnectPanelProjection.panel(from: ConnectFixture.wired).ports[0],
        actions: .inert,
    )
    .frame(width: ArgoConnectPanel.width)
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Port row — nothing connected") {
    ConnectPortRow(
        row: ConnectPanelProjection.panel(from: ConnectFixture.fresh).ports[1],
        actions: .inert,
    )
    .frame(width: ArgoConnectPanel.width)
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Port row — connected, choosing a repository") {
    ConnectPortRow(
        row: ConnectPanelProjection.panel(from: ConnectFixture.choosing).ports[0],
        actions: .inert,
    )
    .frame(width: ArgoConnectPanel.width)
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Port row — the repositories could not be read") {
    ConnectPortRow(
        row: ConnectPanelProjection.panel(from: ConnectFixture.scopesUnreadable).ports[0],
        actions: .inert,
    )
    .frame(width: ArgoConnectPanel.width)
    .padding(ArgoSpacing.region)
    .argoAppearance()
}

#Preview("Port row — the account it used is gone") {
    ConnectPortRow(
        row: ConnectPanelProjection.panel(from: ConnectFixture.broken).ports[0],
        actions: .inert,
    )
    .frame(width: ArgoConnectPanel.width)
    .padding(ArgoSpacing.region)
    .argoAppearance()
}
