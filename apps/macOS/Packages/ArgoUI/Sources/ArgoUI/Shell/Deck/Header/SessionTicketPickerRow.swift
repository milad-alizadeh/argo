import ArgoDesign
import SwiftUI

/// One Ticket in the picker's result list (#1231), with the characters the reader typed lifted
/// out of the rest.
///
/// Hover and the keyboard cursor take DIFFERENT grounds — `surface.hover` and the louder
/// `surface.marked` — for `ComposerMenuRow`'s reason: drawn the same, the list has two cursors the
/// moment the pointer crosses it.
struct SessionTicketPickerRow: View {
    @Environment(\.argo) private var argo

    let match: SessionTicketSearch.Match
    /// Whether the keyboard cursor is on this row. Not the same as being under the pointer.
    let isCurrent: Bool

    @State private var isHovered = false

    var body: some View {
        Text("\(match.before)\(matched)\(match.after)")
            .argoText(ArgoTypography.body)
            .foregroundStyle(argo.color.text.primary)
            .lineLimit(1)
            .truncationMode(.tail)
            .frame(maxWidth: .infinity, alignment: .leading)
            // `tight` and not `base`, because the list around it already spends `tight` insetting
            // this row's ground from the picker's edge: the two together are what put these
            // characters on the field's own leading edge, under its search mark.
            .padding(.horizontal, ArgoSpacing.tight)
            .frame(height: ArgoTicketPicker.rowHeight)
            .background { ground }
            .contentShape(.rect)
            .onHover { isHovered = $0 }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(isCurrent ? [.isSelected, .isButton] : .isButton)
    }

    /// The characters the reader typed, which are the only part of the row that lifts. An
    /// interpolated `Text` keeps its own styling; the plain runs around it take the outer one.
    private var matched: Text {
        Text(match.highlighted)
            .foregroundStyle(argo.color.interaction.accentBright.color)
            .fontWeight(.semibold)
    }

    /// Absent rather than transparent: a clear fill is still a shape over the picker's ground.
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
