import ArgoDesign
import AtlasLayout
import AtlasView
import Foundation
import SwiftUI

/// A small measured Map, so the state that matters most has a render. Two plates, one nested, and
/// files spread over the three bands — the shape a treemap has to survive at any size.
private let previewMap = AtlasMap(
    measuredAt: Date(timeIntervalSince1970: 1_772_000_000),
    commit: "4478553597b9f54568ed277d3753aba87ab1d980",
    root: AtlasPlate(path: "argo", children: [
        .plate(AtlasPlate(path: "argo/Sources", children: [
            .plot(AtlasPlot(path: "argo/Sources/Engine.swift", measures: ["lines": 420])),
            .plot(AtlasPlot(path: "argo/Sources/Roster.swift", measures: ["lines": 180])),
            .plate(AtlasPlate(path: "argo/Sources/Atlas", children: [
                .plot(AtlasPlot(path: "argo/Sources/Atlas/Map.swift", measures: ["lines": 90])),
                .plot(AtlasPlot(path: "argo/Sources/Atlas/Tiler.swift", measures: ["lines": 60])),
                .plot(AtlasPlot(path: "argo/Sources/Atlas/logo.png", measures: [:])),
            ])),
        ])),
        .plate(AtlasPlate(path: "argo/docs", children: [
            .plot(AtlasPlot(path: "argo/docs/CONTEXT.md", measures: ["lines": 140])),
            .plot(AtlasPlot(path: "argo/docs/README.md", measures: ["lines": 30])),
        ])),
    ]),
)

private let previewProject = CockpitPresentation.Project(
    id: "argo",
    name: "argo",
    location: "/Users/somebody/Developer/argo",
    isReachable: true,
    isRegistered: true,
)

#Preview("Atlas room, a generated atlas") {
    @Previewable @State var channels = AtlasChannels.opening(for: previewMap)
    @Previewable @State var hideTests = false
    @Previewable @State var isCity = false

    AtlasRoomView()
        .environment(
            \.argoAtlasRoom,
            AtlasRoom(
                reading: .measured(previewMap), project: previewProject,
                currency: AtlasCurrency {},
                choice: AtlasMapChoice(
                    channels: channels,
                    setChannels: { channels = $0 },
                    hideTests: AtlasSwitch(isOn: hideTests) { hideTests = $0 },
                    isCity: AtlasSwitch(isOn: isCity) { isCity = $0 },
                ),
            ),
        )
        .frame(width: 960, height: 620)
        .argoAppearance()
}

#Preview("Atlas room, no atlas yet") {
    AtlasRoomView()
        .environment(
            \.argoAtlasRoom,
            AtlasRoom(
                reading: .unmeasured, project: previewProject,
                currency: AtlasCurrency {}, choice: .inert,
            ),
        )
        .frame(width: 960, height: 620)
        .argoDeckSurface()
        .argoAppearance()
}

// A Map the repository has moved on from (#1162). The whole room rather than the stage alone,
// because the sentence that says so is the SIDEBAR's now: #1161 took the reading strip off the
// stage, and the staleness clause went with the rest of the provenance into Repository data.
#Preview("Atlas room, a stale atlas") {
    AtlasRoomHost(reading: .measured(previewMap), behind: 12)
        .frame(width: 960, height: 620)
        .argoAppearance()
}
