import ArgoAtoms
import ArgoDesign
import ArgoEngine
import SwiftUI

/// The two gestures that are not a control: something dragged over the vessel, and ⌘V (#540).
///
/// What a drag may be holding is `ComposerDrop`, which reads the same two things the paste does —
/// a file's own path, or pixels with nowhere to be read from.
///
/// A modifier on the whole vessel rather than on the field, because the drop target IS the vessel —
/// the study rejected a 40pt attached seam for exactly this, since a drop wash the height of the
/// Dock read as a strip across the window's bottom edge rather than as a place to let go of a file.
///
/// **The drop is registered even for an adapter that takes none.** That is what lets the refusal
/// carry a reason: a target that declined to register would leave the file bouncing back to the
/// Finder with nothing said, which is the silent drop design decision 9 rules out. What the
/// capability decides is the WASH — Argo says *Drop to attach* only where it will.
struct AttachmentDropTarget: ViewModifier {
    @Environment(\.argo) private var argo

    let canAttach: Bool
    let attach: ([SessionAttachment]) -> Void
    /// Holds the drag-over state open for a render. Only a real drag can raise it otherwise, so
    /// without this the one state the study drew (`dragover.png`) is the one nobody can look at —
    /// the same seam `PlanPill`'s `isRevealed` opens for a hover.
    var isHeldOpen = false

    @State private var isTargeted = false

    func body(content: Content) -> some View {
        content
            .dropDestination(for: ComposerDrop.self) { dropped, _ in
                attach(dropped.map(\.attachment))
                return canAttach
            } isTargeted: { isTargeted = $0 }
            .onPasteCommand(of: ComposerPasteboard.pastedTypes) { _ in
                attach(ComposerPasteboard.attachments())
            }
            .overlay { invitation }
            .argoAnimation(.reveal, value: isInvited)
    }

    /// The wash, the dashed rim and the four words, as one thing that arrives — the whole vessel
    /// taking the state rather than a badge appearing somewhere in it.
    @ViewBuilder private var invitation: some View {
        if isInvited {
            ZStack {
                argo.color.state.wash(argo.color.interaction.accent).color
                // At the vessel-control rung rather than the seam's caption: this is an
                // instruction ON the surface it is about, read at arm's length by somebody whose
                // hand is holding a file, and the approved render sets it a rung above the lines
                // that merely report.
                Text(AttachmentProjection.dropTarget)
                    .argoText(ArgoTypography.control)
                    .foregroundStyle(argo.color.interaction.accent)
            }
            .clipShape(.rect(cornerRadius: ArgoRadius.popover))
            .overlay {
                RoundedRectangle(cornerRadius: ArgoRadius.popover)
                    .strokeBorder(
                        argo.color.interaction.accent.color,
                        style: StrokeStyle(
                            lineWidth: ArgoStroke.indicator,
                            dash: [ArgoStroke.dash * 2, ArgoStroke.dash],
                        ),
                    )
            }
            .allowsHitTesting(false)
            .transition(.opacity)
        }
    }

    private var isInvited: Bool {
        (isTargeted || isHeldOpen) && canAttach
    }
}
