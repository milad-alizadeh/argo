import ArgoEngine
import SwiftUI

/// What the user has given the agent, above the field and before the Turn goes (#540).
///
/// It rides in the slot a queued follow-up and a standing allow ride in, and wraps for the reason
/// the standing-allow tray does: a chip pushed past the vessel's edge is one the user can neither
/// read nor take back, and the `×` is the point of the chip.
///
/// **One chip shape for every source.** A pasted screenshot and a dropped file differ only in the
/// name the chip derives — the user's model of "I gave the agent this" is one thing, and a tray
/// that told them apart would be answering a question nobody asked.
struct AttachmentTray: View {
    let attachments: [SessionAttachment]
    /// Take one back, by id. A closure and not a draft, so the tray renders from a preview or a
    /// specimen with nothing behind it.
    let remove: (SessionAttachment.ID) -> Void

    var body: some View {
        WrapFlow(gap: ArgoSpacing.tight) {
            ForEach(attachments) { attachment in
                AttachmentChip(attachment: attachment) { remove(attachment.id) }
            }
        }
        .padding(.bottom, ArgoSpacing.snug)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Attachments")
    }
}

/// One attachment: the picture or its kind, the name, how big it is, and the way to take it back.
private struct AttachmentChip: View {
    @Environment(\.argo) private var argo

    let attachment: SessionAttachment
    let remove: () -> Void

    /// Decoded once, when the chip arrives, rather than in `body` — a body runs on every layout
    /// pass, and a file read on each of them is a scroll that stutters over a tray.
    @State private var thumbnail: Image?

    var body: some View {
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
        .padding(.trailing, ArgoSpacing.tight)
        .frame(height: ArgoComposerVessel.chipHeight)
        .background(argo.color.surface.control, in: .rect(cornerRadius: ArgoRadius.control))
        .overlay {
            RoundedRectangle(cornerRadius: ArgoRadius.control)
                .strokeBorder(argo.color.edge.subtle, lineWidth: ArgoStroke.hairline)
        }
        .task(id: attachment.id) { thumbnail = AttachmentThumbnail.image(for: attachment) }
        .help(attachment.name)
    }

    /// The picture itself where the bytes yield one, and the kind otherwise. Flush to the chip's
    /// leading edge and clipped to its corner, which is what lets a 20pt thumbnail live inside a
    /// 20pt chip: the image IS that edge rather than something inset from it.
    @ViewBuilder private var mark: some View {
        if let thumbnail {
            thumbnail
                .resizable()
                .scaledToFill()
                .frame(
                    width: ArgoComposerVessel.chipHeight,
                    height: ArgoComposerVessel.chipHeight,
                )
                .clipShape(.rect(cornerRadius: ArgoRadius.control))
        } else {
            ArgoGlyph(glyph, .inline)
                .foregroundStyle(argo.color.text.tertiary)
                .frame(width: ArgoComposerVessel.chipHeight)
        }
    }

    private var glyph: String {
        attachment.isImage ? ArgoSymbol.attachedImage : ArgoSymbol.attachedFile
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
}

#Preview("Attachment tray — a picture and two files") {
    AttachmentTray(attachments: AttachmentFixture.mixed, remove: { _ in })
        .padding(ArgoSpacing.section)
        .frame(width: 640)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Attachment tray — one pasted image") {
    AttachmentTray(attachments: [AttachmentFixture.pasted], remove: { _ in })
        .padding(ArgoSpacing.section)
        .frame(width: 640)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Attachment tray — a narrow vessel and a long name") {
    AttachmentTray(attachments: AttachmentFixture.longNames, remove: { _ in })
        .padding(ArgoSpacing.section)
        .frame(width: 320)
        .argoDeckSurface()
        .argoAppearance()
}
