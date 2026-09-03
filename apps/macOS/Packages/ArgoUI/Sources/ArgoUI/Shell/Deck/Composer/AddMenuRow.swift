import ArgoAtoms
import ArgoDesign
import SwiftUI

/// One row of `AddMenu`: what it opens, the shortcut that opens the same thing directly, and the
/// mark that leads it (design decision 11, `cockpit-composer-picker.md`, `plus.png`).
///
/// The label is set in `body`, not `machine` — it names a SECTION of the drawer rather than a
/// pickable thing, which is what a `ComposerMenuRow` names. The key trails at
/// `machineCaption` in `disabled`, quiet the way a hint is rather than a mark the reader is meant
/// to read first.
struct AddMenuRow: View {
    @Environment(\.argo) private var argo

    let row: ComposerMenu.AddRow
    /// Whether the keyboard cursor is on this row. Not the same as being under the pointer.
    let isCurrent: Bool

    @State private var isHovered = false

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            ArgoGlyph(row.icon, .inline)
                .foregroundStyle(argo.color.text.secondary)
            Text(row.label)
                .argoText(ArgoTypography.body)
                .foregroundStyle(argo.color.text.primary)
                .fixedSize()
            Spacer(minLength: ArgoSpacing.base)
            Text(String(row.key))
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.disabled)
        }
        .padding(.horizontal, ArgoSpacing.base)
        .frame(height: ArgoComposerVessel.commandRowHeight)
        .background { ground }
        .contentShape(.rect)
        .onHover { isHovered = $0 }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isCurrent ? [.isSelected, .isButton] : .isButton)
    }

    /// Absent rather than transparent — the same rule `ComposerMenuRow` draws its ground by, and
    /// for the same reason: a clear fill is still a shape over the menu's material.
    @ViewBuilder private var ground: some View {
        if let fill {
            RoundedRectangle(cornerRadius: ArgoRadius.control).fill(fill)
        }
    }

    private var fill: ArgoColor? {
        switch (isCurrent, isHovered) {
        case (true, _): argo.color.surface.marked
        case (false, true): argo.color.surface.hover
        case (false, false): nil
        }
    }
}

private let filesRow = ComposerMenu.AddRow(
    id: "files",
    label: "Files in this Workspace",
    sigil: .file,
)

#Preview("Add menu row — at rest") {
    AddMenuRow(row: filesRow, isCurrent: false)
        .padding(ArgoSpacing.section)
        .frame(width: 280)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Add menu row — keyboard cursor") {
    AddMenuRow(row: filesRow, isCurrent: true)
        .padding(ArgoSpacing.section)
        .frame(width: 280)
        .argoDeckSurface()
        .argoAppearance()
}
