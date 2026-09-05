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

    /// The file the reader has open beside the map, or none (#1154). This column's own, like the
    /// orientation and for the same reason: nothing in the sidebar opens a file, and what is open
    /// is a way of looking at the map rather than a fact about it — so it is not persisted and a
    /// reopened room opens on the whole shape.
    @State private var openFile: String?

    /// What the reader has typed into the rail's find field (#1155). This column's own for
    /// `openFile`'s reason, and not persisted for the same one: a question is a way of looking at
    /// the map rather than a fact about it, and a reopened room opens on the whole repository.
    @State private var query = ""

    /// `opened` is the file the room STARTS with open, and `typed` the question it starts with
    /// asked. Nothing in the app ever passes either: a reading is opened by a click and a question
    /// is asked at a keyboard, and neither is a gesture a screenshot can drive. They are what let
    /// the specimen harness render those states at all — the design's own `?state=inspect` and
    /// `?state=search`, in the one shape SwiftUI has for seeding state a view then owns.
    init(isActive: Bool = true, opened: String? = nil, typed: String = "") {
        self.isActive = isActive
        _openFile = State(initialValue: opened)
        _query = State(initialValue: typed)
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
        // Escape closes the reading and unmarks the file (#1154): the mark and the panel are one
        // state, so there is one place to clear. `onExitCommand` rather than a key press, because
        // Escape is the platform's own way out of a thing and the responder chain is what knows
        // whether anything nearer wanted it first.
        .onExitCommand { openFile = nil }
        // Nothing survives a change of Project. A map is scoped to the window's Project
        // (ADR-0015), and a reading left standing would be one repository's file read beside
        // another repository's map.
        .onChange(of: room.project?.id) {
            openFile = nil
            query = ""
        }
    }

    /// The stage: the map, and the camera floating over its top-right corner. Nothing else — what
    /// was measured and what it is drawn by are the sidebar's sections now, and the design puts no
    /// bar over the picture (`docs/designs/cockpit-atlas.html`, `#stage`).
    private func measured(_ map: AtlasMap) -> some View {
        // The Map as the reader's filters leave it — the same call the sidebar makes, so the
        // tiling and every number said about it cannot disagree about what was measured.
        let drawn = room.choice.drawn(map)
        // The stage keeps the room it had: the rail takes its width off the end rather than
        // shrinking the map to nothing, and the map is what the reader clicked on.
        return HStack(spacing: ArgoSpacing.flush) {
            stage(drawn)
            AtlasRoomRail(
                query: $query,
                // The list is read off the SAME Map the picture is tiled from, by the same
                // filters, so the two can never disagree about what is in the repository.
                entries: drawn.index(matching: query, by: room.choice.channels),
                open: openFile,
                reading: openFile.flatMap {
                    AtlasFileReading(of: $0, in: drawn, by: room.choice.channels)
                },
                select: { openFile = $0 },
            )
        }
    }

    private func stage(_ drawn: AtlasMap) -> some View {
        ground(drawn)
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
                // Clicking the open file again closes it, and so does clicking the ground — the
                // design's own three ways out, of which Escape is the third. What is open is open
                // because the reader opened it, so the same gesture puts it away.
                focus: AtlasFocus(open: openFile) { openFile = $0 == openFile ? nil : $0 },
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
