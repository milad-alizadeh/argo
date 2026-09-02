import ArgoUI
import SwiftUI

#Preview("Connect — nothing set yet") {
    ConnectPanel(reading: ConnectFixture.fresh, actions: .inert)
        .argoAppearance()
}

#Preview("Connect — a folder and nothing else") {
    ConnectPanel(reading: ConnectFixture.folderOnly, actions: .inert)
        .argoAppearance()
}

#Preview("Connect — half connected, already usable") {
    ConnectPanel(reading: ConnectFixture.partly, actions: .inert)
        .argoAppearance()
}

#Preview("Connect — both ports, two accounts") {
    ConnectPanel(reading: ConnectFixture.wired, actions: .inert)
        .argoAppearance()
}

#Preview("Connect — waiting on the browser") {
    ConnectPanel(reading: ConnectFixture.waiting, actions: .inert)
        .argoAppearance()
}

#Preview("Connect — a bind the provider refused") {
    ConnectPanel(reading: ConnectFixture.refused, actions: .inert)
        .argoAppearance()
}

#Preview("Project settings — the same panel, re-entered") {
    ConnectPanel(reading: ConnectFixture.settings, actions: .inert)
        .argoAppearance()
}
