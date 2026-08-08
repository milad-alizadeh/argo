import ArgoEngine
import SwiftUI

/// What a call SHOWED — the bytes the agent actually looked at.
///
/// The tier is drawn, not just held: `direct` is the transcript's own embedded block, which a
/// later edit to the file cannot invalidate, and `derived` is a re-read of the path NOW. After
/// three renders to one path in a turn those are very often not the same picture, so a panel that
/// showed them alike would be silently wrong in exactly the loop inline media exists to support.
struct EvidenceMedia: View {
    @Environment(\.argo) private var argo

    let media: MediaEvidence

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.base) {
            picture
            caption
        }
        .padding(ArgoSpacing.comfortable)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// A row with no bytes says so. It never draws a broken-image glyph, which is the system
    /// claiming a failure to LOAD where what happened is that nothing was ever recorded.
    @ViewBuilder private var picture: some View {
        if let image = decoded {
            Image(nsImage: image)
                .resizable()
                .scaledToFit()
                .frame(maxWidth: .infinity, alignment: .leading)
                .clipShape(.rect(cornerRadius: ArgoRadius.control))
        } else {
            Text("The record kept no image for this call")
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.disabled)
        }
    }

    private var caption: some View {
        HStack(spacing: ArgoSpacing.snug) {
            Text(media.mediaType)
            Text(provenance)
        }
        .argoText(ArgoTypography.machineCaption)
        .foregroundStyle(argo.color.text.disabled)
    }

    /// Named in words rather than left to a tier badge nobody can read: one of these is what the
    /// agent saw, the other is what is on disk now.
    private var provenance: String {
        switch media.tier {
        case .direct: "as the agent saw it"
        case .derived: "the file as it stands now"
        case .convention: "reported by the plugin"
        }
    }

    private var decoded: NSImage? {
        guard let bytes = media.bytes, let data = Data(base64Encoded: bytes) else { return nil }
        return NSImage(data: data)
    }
}

#Preview("Evidence media — a call whose bytes the record never kept") {
    EvidenceMedia(media: MediaEvidence(tier: .direct, mediaType: "image/png", bytes: nil))
        .frame(width: 420, height: 160)
        .background(ArgoPalette.graphite.surface.sunken)
        .argoAppearance()
}
