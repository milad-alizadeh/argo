import ArgoDesign
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
package struct AttachmentTray: View {
    let attachments: [SessionAttachment]
    /// Take one back, by id. A closure and not a draft, so the tray renders from a preview or a
    /// specimen with nothing behind it.
    let remove: (SessionAttachment.ID) -> Void

    package var body: some View {
        WrapFlow(gap: ArgoSpacing.tight) {
            ForEach(attachments) { attachment in
                AttachmentChip(attachment: attachment) { remove(attachment.id) }
            }
        }
        .padding(.bottom, ArgoSpacing.snug)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Attachments")
    }

    /// Spelled out: Swift synthesises no memberwise initializer above `internal` (#1085).
    package init(
        attachments: [SessionAttachment],
        remove: @escaping (SessionAttachment.ID) -> Void,
    ) {
        self.attachments = attachments
        self.remove = remove
    }
}
