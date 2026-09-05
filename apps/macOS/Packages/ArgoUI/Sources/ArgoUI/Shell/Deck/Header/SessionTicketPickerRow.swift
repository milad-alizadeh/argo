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
        Text("\(part(before: match.matched))\(matched)\(part(after: match.matched))")
            .argoText(ArgoTypography.body)
            .foregroundStyle(argo.color.text.primary)
            .lineLimit(1)
            .truncationMode(.tail)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, ArgoSpacing.base)
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
        Text(part(in: match.matched))
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

    private var label: [Character] {
        Array(match.option.label)
    }

    private func part(before matched: Range<Int>) -> String {
        String(label[..<matched.lowerBound])
    }

    private func part(in matched: Range<Int>) -> String {
        String(label[matched])
    }

    private func part(after matched: Range<Int>) -> String {
        String(label[matched.upperBound...])
    }
}
