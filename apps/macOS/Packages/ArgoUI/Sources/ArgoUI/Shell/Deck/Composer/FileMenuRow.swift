import SwiftUI

/// One file in the composer's `@` menu: its name, the directory holding it, and whether this
/// Session has already been in it (#687, `cockpit-composer-picker.md`).
///
/// The filename leads, and the directory follows cut from the LEFT: what a reader needs off a
/// truncated path is its tail, since the segments before it are shared with every other row.
struct FileMenuRow: View {
    @Environment(\.argo) private var argo

    let row: WorkspaceFileProjection.Row
    /// Whether the keyboard cursor is on this row. Not the same as being under the pointer.
    let isMarked: Bool

    @State private var isHovered = false

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            name
            directory
            Spacer(minLength: ArgoSpacing.base)
            if row.isTouched {
                Text(Self.touched)
                    .argoText(ArgoTypography.badge)
                    .textCase(.uppercase)
                    .foregroundStyle(argo.color.text.disabled)
            }
        }
        .padding(.horizontal, ArgoSpacing.base)
        .frame(height: ArgoComposerVessel.commandRowHeight)
        .background { ground }
        .contentShape(.rect)
        .onHover { isHovered = $0 }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isMarked ? [.isSelected, .isButton] : .isButton)
    }

    /// No accent inking on the matched characters: a subsequence scatters them across the segments,
    /// which speckles the row rather than pointing at anything. `at-filter.png` draws none.
    private var name: some View {
        Text(row.name)
            .argoText(ArgoTypography.machine)
            .foregroundStyle(argo.color.text.primary)
            .lineLimit(1)
            // The directory yields first. An `HStack` shrinks both without this, and a long
            // filename came back cut beside a directory that still had room — losing the one word
            // on the row that distinguishes it. Only a name too wide for the row is cut now.
            .layoutPriority(1)
    }

    @ViewBuilder private var directory: some View {
        if let directory = row.directory {
            Text(directory)
                .argoText(ArgoTypography.machineCaption)
                .foregroundStyle(argo.color.text.tertiary)
                .lineLimit(1)
                .truncationMode(.head)
        }
    }

    /// Absent rather than transparent: a clear fill is still a shape over the menu's material.
    @ViewBuilder private var ground: some View {
        if let fill {
            RoundedRectangle(cornerRadius: ArgoRadius.control).fill(fill)
        }
    }

    private var fill: ArgoColor? {
        switch (isMarked, isHovered) {
        case (true, _): argo.color.surface.marked
        case (false, true): argo.color.surface.hover
        case (false, false): nil
        }
    }

    /// The mark on a file this Session's agent has already read or edited (#687).
    static let touched = "touched"
}
