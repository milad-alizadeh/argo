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

    /// How far the city has climbed out of its plates, 0 to 1 (#1421). This column's own, like the
    /// orientation: the rise is what the map DOES when it arrives, not a fact about the Project,
    /// and nothing in the sidebar starts one.
    @State private var rise: Double = 0

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
        // The list is read off the SAME Map the picture is tiled from, by the same filters, and
        // ONCE — both columns are handed this one answer, so the two can never disagree about
        // what is in the repository.
        let entries = drawn.index(matching: query, by: room.choice.channels)
        // The stage keeps the room it had: the rail takes its width off the end rather than
        // shrinking the map to nothing, and the map is what the reader clicked on.
        return HStack(spacing: ArgoSpacing.flush) {
            stage(drawn, among: entries)
            AtlasRoomRail(
                query: $query,
                entries: entries,
                open: openFile,
                reading: openFile.flatMap {
                    AtlasFileReading(of: $0, in: drawn, by: room.choice.channels)
                },
                select: { openFile = $0 },
            )
        }
    }

    /// What a pick on the map means (#1153, #1154, #1155).
    ///
    /// Picking the open file again closes it, and so does picking the ground — the design's own
    /// three ways out, of which Escape is the third. What is open is open because the reader
    /// opened it, so the same gesture puts it away.
    ///
    /// **A pick the question excludes puts the question away.** The list has to select the row of
    /// the file the map just marked, and it cannot select a row it is not drawing — so the
    /// narrower of the two facts gives. Clearing the reader's words is the visible answer; leaving
    /// them is a marked map beside a list denying the file exists, which is the one state the
    /// ticket rules out.
    private func pick(_ picked: String?, among entries: [AtlasIndexEntry]) {
        guard picked != openFile else {
            openFile = nil
            return
        }
        openFile = picked
        if let picked, !entries.contains(where: { $0.path == picked }) {
            query = ""
        }
    }

    private func stage(_ drawn: AtlasMap, among entries: [AtlasIndexEntry]) -> some View {
        ground(drawn, among: entries)
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
    private func ground(_ map: AtlasMap, among entries: [AtlasIndexEntry]) -> some View {
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
                standing: AtlasStanding(relief: room.choice.isCity.isOn ? 1 : 0, rise: rise),
                orientation: orientation,
                focus: AtlasFocus(open: openFile) { pick($0, among: entries) },
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .padding(ArgoSpacing.loose)
        // A Map arriving, and the reader turning the city on: the two moments there is a city to
        // stand up. Keyed on WHEN the Map was measured rather than on the plan, so a channel
        // change repaints and a filter re-tiles without the city reassembling — a model that
        // rebuilds every time the reader touches a menu is a loading screen.
        .task(id: arrival) { await stand() }
    }

    /// What a rise is spent on: a Map, and whether there is a city to spend it on. Two facts
    /// rather than one, because the room OPENS at the flat end of the camera — a rise run there
    /// climbs heights a straight-down camera does not project, and the reader who then turns the
    /// city on gets it fully built, which is the sentence #1421 opens by complaining about.
    private var arrival: AtlasArrival {
        AtlasArrival(measuredAt: measuredAt, isCity: room.choice.isCity.isOn)
    }

    /// When the drawn Map was measured, or nothing where none is drawn.
    private var measuredAt: Date? {
        guard case let .measured(map) = room.reading else { return nil }
        return map.measuredAt
    }

    /// The city stands up out of its plates (#1421). Every box starts flat and climbs to its
    /// measured height, staggered outwards from the middle of the plan — but none of that is here:
    /// this drives ONE scalar over the role's whole span, and the shader works each box's own
    /// phase out of it against where the box stands.
    ///
    /// `@MainActor` for `FeedIonLoop.run`'s reason: every line writes view state, and `.task`
    /// alone does not keep an `async` method on the main actor.
    @MainActor private func stand() async {
        // Two ways the map is simply THERE, and both answered before the reset rather than by a
        // nil animation: the reset and the tick after it would otherwise put a flat map on screen
        // for a frame, which is the one thing either reader asked not to see.
        //
        // The treemap draws no heights, so `docs/designs/cockpit-atlas.html`'s own `rise()`
        // refuses to spend the role there — and Reduce Motion cuts, which is what
        // `ArgoMotion.rise` carrying no reduced duration means, read off the role rather than
        // decided here.
        guard room.choice.isCity.isOn,
              let sweep = ArgoMotion.risen.sweep.resolved(reduceMotion: reduceMotion)
        else {
            rise = 1
            return
        }
        var cut = Transaction()
        cut.disablesAnimations = true
        withTransaction(cut) { rise = 0 }
        // A tick between the two, for `FeedIonLoop`'s reason: SwiftUI folds every change in one
        // tick into the last value, so a reset in the same tick as the climb leaves nothing to
        // animate — and a rebuild would then show no rise at all.
        try? await Task.sleep(for: .seconds(ArgoMotion.passReentry))
        withAnimation(sweep) { rise = 1 }
    }
}

/// The two facts that decide whether a city has just arrived: which measurement is drawn, and
/// whether the camera is at the end that shows heights (#1421).
///
/// A value rather than two `onChange`s, so the rise has ONE trigger. Two would let a rebuild land
/// in the same frame as a flip and start the climb twice, from two different points.
///
/// The treemap-to-city turn is `ArgoMotion.lieDown`'s when that lands, and the two will have to be
/// reconciled there: a flip that also rises is one move too many.
private struct AtlasArrival: Equatable {
    let measuredAt: Date?
    let isCity: Bool
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
