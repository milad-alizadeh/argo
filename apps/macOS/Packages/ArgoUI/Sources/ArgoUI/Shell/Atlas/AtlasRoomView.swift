import ArgoDesign
import AtlasLayout
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

    /// The room, or the one a window that has resolved none draws: a Project it has none of.
    private var room: AtlasRoom {
        resolved ?? AtlasRoom(reading: .noProject, project: nil, rebuild: {})
    }

    var body: some View {
        Group {
            if case let .measured(map) = room.reading {
                measured(map)
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
            AtlasMapCanvas(map: map, channels: channels(of: map))
        }
    }

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
    /// (#1145), so these two are tried and the Map's own first name is taken when neither is there.
    /// Alphabetical order alone put `age_in_weeks` on footprint, which sizes every file committed
    /// this week to nothing. `bytes` was tried next and is worse on a real repository: one 4.8 MB
    /// fixture takes most of the map and everything else becomes a sliver. A legible opening is
    /// worth stating a preference for.
    private func channels(of map: AtlasMap) -> AtlasChannels {
        let names = map.measureNames
        let preferred = ["lines", "bytes"].first { names.contains($0) }
        return AtlasChannels(preferred ?? names.first ?? "")
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
