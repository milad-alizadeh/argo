import ArgoDesign
import SwiftUI

/// One pickable thing in a composer menu: what it is, what identifies it, and any mark it carries
/// — the same row for `/` and `@` (#685, #687).
///
/// Hover and the keyboard cursor take DIFFERENT grounds — `surface.hover` and the louder
/// `surface.marked`. Drawn the same, the list has two cursors the moment the pointer crosses it.
struct ComposerMenuRow: View {
    @Environment(\.argo) private var argo

    let row: ComposerMenu.Row
    /// Whether the keyboard cursor is on this row. Not the same as being under the pointer.
    let isCurrent: Bool

    @State private var isHovered = false

    var body: some View {
        HStack(spacing: ArgoSpacing.base) {
            lead
            detail
            Spacer(minLength: ArgoSpacing.base)
            // Keyed by place and not by words: two badges reading the same would collide, and
            // a row's badges are a fixed short list whose order is the derive's own.
            ForEach(Array(row.badges.enumerated()), id: \.offset) { _, badge in
                self.badge(badge)
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

    /// What the row is, with the characters the reader typed inked in the accent. An interpolated
    /// `Text` keeps its own styling; the plain runs around it take the outer one.
    private var lead: some View {
        Text("\(part(before: row.matched))\(matched)\(part(after: row.matched))")
            .argoText(ArgoTypography.machine)
            .foregroundStyle(argo.color.text.primary)
            .lineLimit(1)
            // The detail yields first, for BOTH sigils. An `HStack` shrinks both without this, and
            // a long filename came back cut beside a directory that still had room — losing the one
            // word on the row that distinguishes it. The `/` menu's description is the same case:
            // it is the row's content, but the command is what the reader is picking.
            .layoutPriority(1)
    }

    /// The characters the reader typed, which are the only part of the lead that lifts.
    private var matched: Text {
        Text(part(in: row.matched))
            .foregroundStyle(argo.color.interaction.accentBright.color)
            .fontWeight(.semibold)
    }

    @ViewBuilder private var detail: some View {
        if let detail = row.detail {
            let look = look(of: detail.voice)
            Text(detail.words)
                .argoText(look.face)
                .foregroundStyle(look.lifts && isCurrent
                    ? argo.color.text.marked(on: argo.color.text.tertiary)
                    : argo.color.text.tertiary)
                .lineLimit(1)
                .truncationMode(look.truncation)
        }
    }

    /// How a detail is set. The three travel together, so they arrive together.
    private struct Look {
        let face: ArgoTextStyle
        let truncation: Text.TruncationMode
        /// Whether the text lifts on the cursor row.
        let lifts: Bool
    }

    /// Every way a voice is set, off ONE switch: a third `Voice` fails to compile here rather than
    /// picking up two of the three from a default arm.
    ///
    /// Only a `.sentence` lifts on the cursor row, to the floor `marked(on:)` sets for text
    /// standing on that ground. A `.path` is the row's address rather than its content, and the
    /// lead beside it already says the cursor is here. It is cut from the LEFT for the same reason:
    /// what a reader needs off a truncated path is its tail.
    private func look(of voice: ComposerMenu.Detail.Voice) -> Look {
        switch voice {
        case .sentence: Look(face: ArgoTypography.rowMeta, truncation: .tail, lifts: true)
        case .path: Look(face: ArgoTypography.machineCaption, truncation: .head, lifts: false)
        }
    }

    private func badge(_ badge: ComposerMenu.Badge) -> some View {
        let look = look(of: badge.tone)
        return Text(badge.words)
            .argoText(ArgoTypography.badge)
            .textCase(look.casing)
            .foregroundStyle(look.ink)
    }

    /// Only a fact gets upper-cased. Something the reader is being TOLD keeps its own casing,
    /// because a sentence in caps reads as a label nobody has to act on.
    private func look(of tone: ComposerMenu.Badge.Tone) -> (casing: Text.Case?, ink: ArgoColor) {
        switch tone {
        case .quiet: (.uppercase, argo.color.text.disabled)
        case .attention: (nil, argo.color.state.attention)
        }
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
        String(Array(row.lead)[..<matched.lowerBound])
    }

    private func part(in matched: Range<Int>) -> String {
        String(Array(row.lead)[matched])
    }

    private func part(after matched: Range<Int>) -> String {
        String(Array(row.lead)[matched.upperBound...])
    }
}
