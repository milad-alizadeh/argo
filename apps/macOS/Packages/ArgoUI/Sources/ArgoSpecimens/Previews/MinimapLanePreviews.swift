import ArgoUI
import SwiftUI

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
