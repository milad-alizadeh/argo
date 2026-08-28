import SwiftUI

/// The backlog's disclosure twist, at the row's leading edge (`cockpit-work-room.md` — the backlog
/// list). Drawn rather than `DisclosureGroup`'s, so it can carry its own hit target and so a leaf
/// can keep the slot (`cockpit-work-room.inventory.md`).
struct BacklogTwist: View {
    @Environment(\.argo) private var argo

    /// `nil` on a leaf: nothing to open, and the slot stands empty rather than closing up.
    let toggle: (() -> Void)?
    let isOpen: Bool

    var body: some View {
        if let toggle {
            Button(action: toggle) { slot }
                .buttonStyle(.plain)
                .accessibilityLabel(isOpen ? "Collapse" : "Expand")
        } else {
            slot.hidden()
        }
    }

    /// The mark inside the whole slot, and the slot is what the press lands on. The frame is INSIDE
    /// the button: outside it the target is the 8pt mark's stem rather than the row's own column.
    private var slot: some View {
        ArgoDisclosure(isOpen ? .below : .beside)
            .foregroundStyle(argo.color.text.disabled)
            .frame(width: ArgoBacklogList.twistWidth, height: ArgoBacklogList.rowHeight)
            .contentShape(Rectangle())
            // The slot is twelve points across, which is the column the dots line up on and not a
            // target. This widens what answers the press past it without moving the mark.
            .argoHitTarget()
    }
}

#Preview("Backlog twist — open, shut, and the slot a leaf keeps") {
    VStack(alignment: .leading, spacing: ArgoSpacing.base) {
        BacklogTwist(toggle: {}, isOpen: true)
        BacklogTwist(toggle: {}, isOpen: false)
        BacklogTwist(toggle: nil, isOpen: false)
    }
    .padding(ArgoSpacing.region)
    .argoDeckSurface()
    .argoAppearance()
}
