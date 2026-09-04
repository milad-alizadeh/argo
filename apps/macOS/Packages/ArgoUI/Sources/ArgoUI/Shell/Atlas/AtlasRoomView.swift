import ArgoDesign
import AtlasLayout
import AtlasView
import Foundation
import SwiftUI

/// The Atlas room: the map of the active Project, and what was measured to draw it.
///
/// The reading strip above the map is what makes a measurement checkable — how many files were
/// found, which commit was measured, when, and which Measure is on each channel. A map with no
/// numbers beside it is a picture nobody can falsify.
struct AtlasRoomView: View {
    @Environment(\.argo) private var argo
    /// Injected from above the deck rather than taken as a parameter — `argoAtlasRoom` says why.
    @Environment(\.argoAtlasRoom) private var resolved
    /// Whether this is the room on screen. `InstrumentDeckShell` keeps every room mounted so a
    /// switch destroys nothing (#1356), which makes this the one thing that still tells the map's
    /// tiling and its Metal surface not to redraw for a reader who cannot see them — existence is
    /// no longer the gate, so activity has to be.
    var isActive = true

    init(isActive: Bool = true) {
        self.isActive = isActive
    }

    /// The room, or the one a window that has resolved none draws: a Project it has none of.
    private var room: AtlasRoom {
        resolved ?? AtlasRoom(reading: .noProject, project: nil, rebuild: {})
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
                    rebuild: room.rebuild,
                )
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func measured(_ map: AtlasMap) -> some View {
        VStack(spacing: ArgoSpacing.flush) {
            strip(map)
            ground(map)
        }
    }

    /// The map, tiled into the room's own ground. `AtlasView` frames itself at the plan's extent
    /// and hangs its key under that, so the ground is what the tiling is sized by and the key
    /// falls in the room's padding below it.
    ///
    /// Tiled in the BODY rather than inside the view, because a plan is recomputed when the size
    /// moves and a body is not a frame (ADR-0028 rule 3).
    ///
    /// Drawn at the FLAT end of the camera, which is the reading the room ships with: the plates
    /// carry their names here, and a name is laid out in plan coordinates — turned, every caption
    /// would sit over a building it does not name. The room reaches the city when the reader can
    /// turn it (#1152), which is also when the names get a place in the picture.
    private func ground(_ map: AtlasMap) -> some View {
        GeometryReader { proxy in
            AtlasView(
                plan: AtlasPlan(
                    tiling: map,
                    by: channels(of: map),
                    into: CGSize(
                        width: proxy.size.width - ArgoSpacing.loose * 2,
                        height: proxy.size.height - Self.keyRoom,
                    ),
                ),
                relief: 0,
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .padding(.horizontal, ArgoSpacing.loose)
        .padding(.bottom, ArgoSpacing.base)
    }

    /// What the key under the map costs the tiling. A measure beside the one surface that reads it
    /// rather than a token (`rules/swift.md`): it is what `AtlasLegendKey` stands in, not a rhythm
    /// step, and it comes off the ground so the two do not overrun the room between them.
    private static let keyRoom: CGFloat = 76

    private func strip(_ map: AtlasMap) -> some View {
        HStack(spacing: ArgoSpacing.comfortable) {
            Text(room.project?.name ?? "Atlas")
                .argoText(ArgoTypography.rowTitle)
                .foregroundStyle(argo.color.text.primary)
            Text(reading(of: map))
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
                .lineLimit(1)
            Spacer(minLength: ArgoSpacing.base)
            AtlasRebuildButton(title: "Generate again", rebuild: room.rebuild)
        }
        .padding(.horizontal, ArgoSpacing.loose)
        .padding(.vertical, ArgoSpacing.base)
    }

    /// Everything a reader needs to say whether the map is current: how much was found, what it was
    /// measured against, and which Measure each channel is spending.
    ///
    /// One clause per fact, in the order a reader asks them. The channels collapse to one clause
    /// while the same Measure drives both, which is what the opening reading does — "sized and
    /// coloured by lines" says in four words what naming the channels twice says in eight.
    private func reading(of map: AtlasMap) -> String {
        let commit = map.commit.map { String($0.prefix(7)) } ?? "no commits yet"
        let measure = channels(of: map)
        let channels = measure.footprint == measure.band
            ? "sized and coloured by \(measure.footprint)"
            : "sized by \(measure.footprint), coloured by \(measure.band)"
        return "\(map.plots.count) files · \(commit) · \(channels)"
    }

    /// The opening reading, before anything can be chosen. #1161 gives the reader the choice.
    ///
    /// A PREFERENCE and not an assumption: the Measure set is open and belongs to the repository
    /// (#1145), so each channel tries its names in turn and falls back on what the Map carries.
    /// Alphabetical order alone put `age_in_weeks` on footprint, which sizes every file committed
    /// this week to nothing. `bytes` was tried next and is worse on a real repository: one 4.8 MB
    /// fixture takes most of the map and everything else becomes a sliver.
    ///
    /// Two DIFFERENT Measures where the repository has both, which is what `AtlasMapSpecimen`
    /// picked for its own reason: with one Measure on both channels, nothing in the picture can be
    /// read off a colour that the size has not already said.
    ///
    /// The height channel takes the band's Measure. The room draws flat, where every height is
    /// scaled to nothing, so this is the channel's name and not a reading — the reader chooses one
    /// at #1161, and until then a third preference here would be a claim nobody can see.
    private func channels(of map: AtlasMap) -> AtlasChannels {
        let names = map.measureNames
        let footprint = ["lines", "bytes"].first { names.contains($0) } ?? names.first ?? ""
        let band = ["commits", "authors"].first { names.contains($0) } ?? footprint
        return AtlasChannels(footprint: footprint, band: band, height: band)
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
    AtlasRoomView()
        .environment(
            \.argoAtlasRoom,
            AtlasRoom(reading: .measured(previewMap), project: previewProject, rebuild: {}),
        )
        .frame(width: 960, height: 620)
        .argoAppearance()
}

#Preview("Atlas room, no atlas yet") {
    AtlasRoomView()
        .environment(
            \.argoAtlasRoom,
            AtlasRoom(reading: .unmeasured, project: previewProject, rebuild: {}),
        )
        .frame(width: 960, height: 620)
        .argoDeckSurface()
        .argoAppearance()
}
