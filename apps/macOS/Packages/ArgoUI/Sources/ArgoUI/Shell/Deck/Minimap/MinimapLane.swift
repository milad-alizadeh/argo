import SwiftUI

/// The overview beside the reading: where the Session's events sit in the whole of it, and where in
/// that whole the reader currently is (D25).
///
/// It takes the feed's handle rather than the rows, because everything it draws is geometry the
/// table already owns — the measured heights, the gutters and the offset. A lane that summed
/// anything else would put a rect where the row it stands for is not.
struct MinimapLane: NSViewRepresentable {
    let feed: FeedTableHandle

    /// Which Turn a still is naming. `.nothing` in the running app, always — a hover comes from a
    /// pointer, and this is only how a render reaches the state (#382).
    var naming: MinimapNaming = .nothing

    func makeNSView(context: Context) -> MinimapLaneView {
        let lane = MinimapLaneView()
        lane.setAccessibilityLabel("Minimap lane")
        dress(lane, in: context.environment)
        return lane
    }

    func updateNSView(_ lane: MinimapLaneView, context: Context) {
        dress(lane, in: context.environment)
    }

    private func dress(_ lane: MinimapLaneView, in environment: EnvironmentValues) {
        lane.palette = environment.argo.color
        lane.raisesContrast = environment.accessibilityDifferentiateWithoutColor
            || environment.colorSchemeContrast == .increased
        // A click's scroll is the one motion here, and under Reduce Motion the whole content of
        // that change is the movement — so it lands instead.
        lane.pace = environment.accessibilityReduceMotion
            ? nil
            : ArgoMotion.selection.duration
        lane.naming = naming
        lane.attach(to: feed)
    }
}

#Preview("Minimap lane — a session at the length a real one reaches") {
    FeedPreview(rows: FeedProjection.longRows, showsOverview: true)
        .frame(width: 820, height: 560)
}

#Preview("Minimap lane — a reading shorter than the lane beside it") {
    FeedPreview(rows: Array(FeedProjection.previewRows.prefix(3)), showsOverview: true)
        .frame(width: 820, height: 560)
}

#Preview("Minimap lane — a Session that has said nothing") {
    FeedPreview(rows: [], showsOverview: true)
        .frame(width: 820, height: 320)
}

#Preview("Minimap lane — the pointer naming one Turn") {
    var preview = FeedPreview(rows: FeedProjection.longRows, showsOverview: true)
    preview.naming = .turn(atShare: 0.4)
    return preview.frame(width: 820, height: 560)
}

#Preview("Minimap lane — ⇧⌘, every Turn named at once") {
    var preview = FeedPreview(rows: FeedProjection.longRows, showsOverview: true)
    preview.naming = .everyTurn
    return preview.frame(width: 820, height: 560)
}

#Preview("Minimap lane — every kind the feed can draw") {
    FeedPreview(rows: FeedProjection.previewRows, showsOverview: true)
        .frame(width: 820, height: 560)
}
