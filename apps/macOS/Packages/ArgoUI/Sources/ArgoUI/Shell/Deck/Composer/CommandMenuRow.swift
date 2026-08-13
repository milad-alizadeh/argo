import SwiftUI

/// One invocable thing in the composer's `/` menu: the command, what its own frontmatter says about
/// it, and — while the sections group by match rather than by origin — where it came from.
///
/// The two grounds are DIFFERENT inks on purpose: hover is `surface.hover` and the keyboard cursor
/// is the louder `surface.marked`. Drawn the same, the list would have two cursors the moment the
/// pointer crossed it.
///
/// **No leading accent edge**, though the approved design specified one — the cockpit does not draw
/// leading rules on rows at all, so the ground alone carries the cursor. The design was amended to
/// match rather than left disagreeing with the code.
struct CommandMenuRow: View {
    @Environment(\.argo) private var argo

    let row: CommandMenuProjection.Row
    /// Whether the keyboard cursor is on this row. Not the same as being under the pointer.
    let isMarked: Bool

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
        .accessibilityAddTraits(isMarked ? [.isSelected, .isButton] : .isButton)
    }

    /// The command, with the characters the reader typed inked in the accent. Three runs and not an
    /// attributed string: the ink is a role off the palette, and `Text` is what carries one.
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
        return isMarked ? argo.color.text.marked(on: voice) : voice
    }

    /// Absent rather than transparent for a row that is neither marked nor under the pointer: a
    /// clear fill would still be a shape drawn over the menu's own material.
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

    private func part(before matched: Range<Int>) -> String {
        String(Array(row.command)[..<matched.lowerBound])
    }

    private func part(in matched: Range<Int>) -> String {
        String(Array(row.command)[matched])
    }

    private func part(after matched: Range<Int>) -> String {
        String(Array(row.command)[matched.upperBound...])
    }

    /// What stands where a description would, for a skill whose frontmatter states none (decision
    /// 5). A statement about the FILE rather than an invented caption, and no slant: the contract
    /// carries a face and a weight, never a slope.
    static let undescribed = "no description in its frontmatter"

    /// The mark on a row standing where one of the user's own skills would be (decision 7).
    static let shadows = "shadows yours"
}
