import ArgoDesign
import AtlasLayout
import AtlasView
import Foundation
import SwiftUI

/// The Atlas room: the map of the active Project, and the camera over it. Nothing else.
///
/// What makes a measurement checkable — how many files were found, which commit was measured, and
/// which Measure is on each channel — is the SIDEBAR's now (`AtlasSidebar`), which is where the
/// design puts it and where the controls that decide those channels already are. A map with no
/// numbers beside it is still a picture nobody can falsify; the numbers moved, they did not go.
struct AtlasRoomView: View {
    @Environment(\.argo) private var argo
    /// Injected from above the deck rather than taken as a parameter — `argoAtlasRoom` says why.
    @Environment(\.argoAtlasRoom) private var resolved
    @Environment(\.argoReduceMotion) private var reduceMotion

    /// Whether this is the room on screen. `InstrumentDeckShell` keeps every room mounted so a
    /// switch destroys nothing (#1356), which makes this the one thing that still tells the map's
    /// tiling and its Metal surface not to redraw for a reader who cannot see them — existence is
    /// no longer the gate, so activity has to be.
    var isActive = true

    /// The turn and tilt the reader has driven the city to (#1152) — held here rather than in
    /// `AtlasView`, which stays a pure function of what it is handed. Genuinely this column's own,
    /// unlike `isCity`: nothing in the sidebar turns the camera.
    @State private var orientation = AtlasOrientation.opening

    init(isActive: Bool = true) {
        self.isActive = isActive
    }

    /// The room, or the one a window that has resolved none draws: a Project it has none of.
    private var room: AtlasRoom {
        resolved ?? AtlasRoom(
            reading: .noProject, project: nil, currency: AtlasCurrency {}, choice: .inert,
        )
    }

    var body: some View {
        Group {
            if case let .measured(map) = room.reading {
                if isActive {
                    measured(map)
                } else {
                    Color.clear
                }
            } else {
                AtlasRoomVacancy(
                    reading: room.reading,
                    project: room.project?.name,
                    rebuild: room.currency.rebuild,
                )
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// The stage: the map, and the camera floating over its top-right corner. Nothing else — what
    /// was measured and what it is drawn by are the sidebar's sections now, and the design puts no
    /// bar over the picture (`docs/designs/cockpit-atlas.html`, `#stage`).
    private func measured(_ map: AtlasMap) -> some View {
        // The Map as the reader's filters leave it — the same call the sidebar makes, so the
        // tiling and every number said about it cannot disagree about what was measured.
        ground(room.choice.drawn(map))
            .overlay(alignment: .topTrailing) {
                // The design's own `#orbit`, floating over the stage rather than docked in a bar,
                // and inset from the corner by what the design insets it by.
                AtlasCameraControl(orientation: $orientation, isCity: room.choice.isCity.isOn)
                    .padding(ArgoSpacing.comfortable)
            }
    }

    /// The map, tiled into the room's own ground.
    ///
    /// Tiled in the BODY rather than inside the view, because a plan is recomputed when the size
    /// moves and a body is not a frame (ADR-0028 rule 3).
    ///
    /// The room ships at the FLAT end of the camera: the plates carry their names there, and a
    /// name is laid out in plan coordinates — turned, every caption would sit over a building it
    /// does not name, which is why the city draws with none.
    private func ground(_ map: AtlasMap) -> some View {
        GeometryReader { proxy in
            AtlasView(
                plan: AtlasPlan(
                    tiling: map,
                    by: room.choice.channels,
                    into: CGSize(
                        width: proxy.size.width - ArgoSpacing.loose * 2,
                        height: proxy.size.height - ArgoSpacing.loose * 2,
                    ),
                ),
                relief: room.choice.isCity.isOn ? 1 : 0,
                orientation: orientation,
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .padding(ArgoSpacing.loose)
    }
}

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
