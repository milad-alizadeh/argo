import ArgoDesign
import AtlasLayout
import SwiftUI

/// THE READING. What a file is, said beside the map the reader clicked it on (#1154, the approved
/// design's `AtlasReading`).
///
/// Beside the map and never over it: the picture the reader was looking at stays on screen while
/// they read about it, which is the whole point of opening it here rather than anywhere else.
///
/// **The panel says what it is showing and nothing else.** No "pinned", and no button to undo it:
/// what is open is open because the reader opened it, and Escape is what closes it — which is the
/// design's own rule, and the reason there is no chrome in this view describing its own mechanism.
///
/// Every number here is measured out of the repository, and the one a number cannot carry alone is
/// drawn against the repository's own spread (`AtlasReadingGauge`).
public struct AtlasReadingPanel: View {
    @Environment(\.argo) private var argo

    private let reading: AtlasFileReading

    public init(reading: AtlasFileReading) {
        self.reading = reading
    }

    public var body: some View {
        ScrollView(.vertical) {
            VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
                heading
                AtlasReadingFacts(facts: reading.facts)
                    .padding(.top, ArgoSpacing.comfortable)
                AtlasReadingGauge(gauge: reading.gauge)
                    .padding(.top, ArgoSpacing.loose)
                AtlasReadingTable(rows: reading.rows)
                    .padding(.top, ArgoSpacing.loose)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, ArgoSpacing.loose)
            .padding(.vertical, ArgoSpacing.comfortable)
        }
        // The rail sits one step UNDER the stage, which is the design's own `#rail` ground: a
        // column flush to the window's edge reads as behind the picture beside it, not level with
        // it.
        .background(argo.color.surface.sunken)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Reading, \(reading.path)")
    }

    /// What kind of thing this is, what it is called, and where it lives.
    ///
    /// The path is said in full under the name, because a repository has thirty `README.md` and
    /// the name alone does not say which — the same reason the name bar over the map carries the
    /// folders in front of the file.
    private var heading: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            Text("File")
                .textCase(.uppercase)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
            Text(reading.name)
                .argoText(ArgoTypography.identityHeading)
                .foregroundStyle(argo.color.text.primary)
                .padding(.top, ArgoSpacing.tight)
            Text(reading.path)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
                .padding(.top, ArgoSpacing.snug)
        }
        // A path has no spaces to break at, so it wraps mid-word or it runs off the rail.
        .fixedSize(horizontal: false, vertical: true)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// A file measured for everything, so the panel's full reading has a render.
private let wholeReading = AtlasFileReading(
    path: "argo/apps/macOS/Packages/ArgoUI/Sources/ArgoUI/Shell/CockpitView.swift",
    facts: [
        .init(fact: .lines, value: 143),
        .init(fact: .authors, value: 4),
        .init(fact: .commits, value: 47),
        .init(fact: .age, value: 1),
    ],
    gauge: AtlasGauge(
        measure: "commits",
        placement: AtlasPlacement(value: 47, fraction: 0.82),
    ),
    rows: [
        .init(measure: "bytes", value: 5102, isDrawn: true),
        .init(measure: "complexity", value: 19, isDrawn: false),
    ],
)

/// The state the ticket's last criterion is about: a file git has no history for, and a Measure
/// nothing recorded. Worth its own render, because the failure it guards against is a panel
/// quietly reading 0 everywhere.
private let unmeasuredReading = AtlasFileReading(
    path: "argo/docs/designs/composer-picker/at-filter.png",
    facts: AtlasFact.allCases.map { .init(fact: $0, value: nil) },
    gauge: AtlasGauge(measure: "commits", placement: nil),
    rows: [.init(measure: "bytes", value: 18402, isDrawn: true)],
)

private struct AtlasReadingPreview: View {
    let reading: AtlasFileReading

    var body: some View {
        AtlasReadingPanel(reading: reading)
            .frame(width: 360, height: 520)
            .argoAppearance()
    }
}

#Preview("Atlas reading — a file measured for everything") {
    AtlasReadingPreview(reading: wholeReading)
}

#Preview("Atlas reading — a file the repository measured nothing for") {
    AtlasReadingPreview(reading: unmeasuredReading)
}
