import SwiftUI

/// One invocable thing in the composer's `/` menu: the command, what its own frontmatter says about
/// it, and — while the sections group by match rather than by origin — where it came from.
///
/// Hover and the keyboard cursor take DIFFERENT grounds — `surface.hover` and the louder
/// `surface.marked`. Drawn the same, the list has two cursors the moment the pointer crosses it.
struct CommandMenuRow: View {
    @Environment(\.argo) private var argo

    let row: CommandMenuProjection.Row
    /// Whether the keyboard cursor is on this row. Not the same as being under the pointer.
    let isCurrent: Bool

    @State private var isHovered = false

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            name
            description
            Spacer(minLength: ArgoSpacing.base)
            if row.shadowsUser {
                Text(Self.shadows)
                    .argoText(ArgoTypography.badge)
                    .foregroundStyle(argo.color.state.attention)
            }
            if let origin = row.origin {
                Text(origin)
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
        .accessibilityAddTraits(isCurrent ? [.isSelected, .isButton] : .isButton)
    }

    /// The command, with the characters the reader typed inked in the accent.
    private var name: some View {
        (Text(part(before: row.matched))
            + Text(part(in: row.matched))
            .foregroundStyle(argo.color.interaction.accentBright.color)
            .fontWeight(.semibold)
            + Text(part(after: row.matched)))
            .argoText(ArgoTypography.machine)
            .foregroundStyle(argo.color.text.primary)
            .lineLimit(1)
    }

    /// One line, tail-truncated — the head of the sentence is the part that identifies the skill.
    /// On the cursor row it lifts to `secondary`, which is the floor `marked(on:)` sets for text
    /// standing on that ground.
    private var description: some View {
        Text(row.description ?? Self.undescribed)
            .argoText(ArgoTypography.rowMeta)
            .foregroundStyle(descriptionInk)
            .lineLimit(1)
            .truncationMode(.tail)
    }

    private var descriptionInk: ArgoColor {
        let voice = argo.color.text.tertiary
        return isCurrent ? argo.color.text.marked(on: voice) : voice
    }

    /// Absent rather than transparent: a clear fill is still a shape over the menu's material.
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

    private func part(before matched: Range<Int>) -> String {
        String(Array(row.command)[..<matched.lowerBound])
    }

    private func part(in matched: Range<Int>) -> String {
        String(Array(row.command)[matched])
    }

    private func part(after matched: Range<Int>) -> String {
        String(Array(row.command)[matched.upperBound...])
    }

    /// A statement about the FILE, for a skill whose frontmatter states no description (#685).
    static let undescribed = "no description in its frontmatter"

    /// The mark on a row standing where one of the user's own skills would be (#685).
    static let shadows = "shadows yours"
}
