import ArgoDesign
import AtlasLayout
import SwiftUI

/// What each channel measures (#1161): which Measure sizes a file, which raises it, and which
/// colours it. The design's `AtlasEncoding` section.
///
/// Picking a Measure never re-tiles from here: the plan is a pure function of the Map and the
/// channels, recomputed wherever a caller reads it, so a colour change is a repaint and costs no
/// more than the write below does.
public struct AtlasEncoding: View {
    /// Every Measure the Map carries, sorted — the same list every row offers, because a Measure
    /// on one channel is not barred from another (#1161's "three channels that say three different
    /// things", never three DIFFERENT lists).
    private let measures: [String]
    @Binding private var channels: AtlasChannels

    public init(measures: [String], channels: Binding<AtlasChannels>) {
        self.measures = measures
        _channels = channels
    }

    public var body: some View {
        AtlasSidebarSection("Encoding") {
            AtlasSidebarRow("Area") { picker("Area", selection: footprint) }
            AtlasSidebarRow("Height") { picker("Height", selection: height) }
            AtlasSidebarRow("Colour") { picker("Colour", selection: band) }
        }
    }

    private func picker(_ title: String, selection: Binding<String>) -> some View {
        Picker(title, selection: selection) {
            ForEach(measures, id: \.self) { measure in
                Text(measure).tag(measure)
            }
        }
        .labelsHidden()
        .argoText(ArgoTypography.control)
        .frame(maxWidth: Self.pickerWidth, alignment: .trailing)
        .accessibilityLabel("\(title), \(selection.wrappedValue)")
    }

    /// What a menu may take of the rail before the name beside it starts to truncate — the
    /// design's own ceiling on the row's control half.
    private static let pickerWidth: CGFloat = 152

    private var footprint: Binding<String> {
        channel(\.footprint) { AtlasChannels(footprint: $1, band: $0.band, height: $0.height) }
    }

    private var height: Binding<String> {
        channel(\.height) { AtlasChannels(footprint: $0.footprint, band: $0.band, height: $1) }
    }

    private var band: Binding<String> {
        channel(\.band) { AtlasChannels(footprint: $0.footprint, band: $1, height: $0.height) }
    }

    /// One channel of the three, read by key path and written whole. `AtlasChannels` is a value
    /// with no settable parts, so every write here rebuilds it — which is what keeps a channel
    /// change one assignment the room can persist rather than three.
    private func channel(
        _ read: KeyPath<AtlasChannels, String>,
        write: @escaping (AtlasChannels, String) -> AtlasChannels,
    )
        -> Binding<String> {
        Binding(
            get: { channels[keyPath: read] },
            set: { channels = write(channels, $0) },
        )
    }
}
