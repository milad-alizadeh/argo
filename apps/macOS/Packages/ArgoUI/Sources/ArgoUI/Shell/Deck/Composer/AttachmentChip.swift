import ArgoAtoms
import ArgoDesign
import ArgoEngine
import SwiftUI

/// One attachment: the picture or its kind, the name, how big it is, and the way to take it back.
///
/// The `×` is the point of the chip. Something given to an agent that can only be taken back by
/// clearing the whole field is not a decision a person can make carefully, so the way out sits ON
/// the record of it.
package struct AttachmentChip: View {
    @Environment(\.argo) private var argo

    let attachment: SessionAttachment
    let remove: () -> Void

    /// Decoded once, when the chip arrives, rather than in `body` — a body runs on every layout
    /// pass, and a file read on each of them is a tray that stutters as it wraps.
    @State private var thumbnail: Image?

    package var body: some View {
        HStack(spacing: ArgoSpacing.tight) {
            mark
            Text(attachment.name)
                .argoText(ArgoTypography.rowMeta)
                .foregroundStyle(argo.color.text.secondary)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: ArgoComposerVessel.chipNameCeiling, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
            if let size = AttachmentProjection.size(attachment) {
                Text(size)
                    .argoText(ArgoTypography.machineCaption)
                    .foregroundStyle(argo.color.text.tertiary)
            }
            dismiss
        }
        .padding(.leading, ArgoSpacing.tight)
        .padding(.trailing, ArgoSpacing.tight)
        .frame(height: ArgoComposerVessel.attachmentChipHeight)
        .background(argo.color.surface.control, in: .rect(cornerRadius: ArgoRadius.control))
        .overlay {
            RoundedRectangle(cornerRadius: ArgoRadius.control)
                .strokeBorder(argo.color.edge.subtle, lineWidth: ArgoStroke.hairline)
        }
        .task(id: attachment.id) { thumbnail = await AttachmentThumbnail.image(for: attachment) }
        .help(attachment.name)
    }

    /// The picture itself where the bytes yield one, and the kind otherwise — 20pt either way, with
    /// the chip's own `tight` padding around it rather than flush to its edges. A thumbnail seated
    /// at the chip's full height reads as an image that overflowed its container, which is what the
    /// approved render's 28pt chip exists to prevent.
    @ViewBuilder private var mark: some View {
        if let thumbnail {
            thumbnail
                .resizable()
                .scaledToFill()
                .frame(
                    width: ArgoComposerVessel.attachmentThumbnail,
                    height: ArgoComposerVessel.attachmentThumbnail,
                )
                .clipShape(.rect(cornerRadius: ArgoRadius.control))
        } else {
            // At `.inline` and not `.chevron`, though the study drew a lighter mark: this one names
            // what the attachment IS, and the rung below it is a chevron's alone.
            ArgoGlyph(AttachmentProjection.glyph(for: attachment), .inline)
                .foregroundStyle(argo.color.text.tertiary)
                .frame(width: ArgoComposerVessel.attachmentThumbnail)
        }
    }

    private var dismiss: some View {
        Button(action: remove) {
            ArgoGlyph(ArgoSymbol.dismiss, .inline)
                .foregroundStyle(argo.color.text.tertiary)
                .frame(
                    width: ArgoComposerVessel.chipDismissDiameter,
                    height: ArgoComposerVessel.chipDismissDiameter,
                )
                .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(AttachmentProjection.removal(attachment))
        .help(AttachmentProjection.removal(attachment))
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(attachment: SessionAttachment, remove: @escaping () -> Void) {
        self.attachment = attachment
        self.remove = remove
    }
}
