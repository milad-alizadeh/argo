import SwiftUI

/// What the Session is working on and with, on the quiet line under its title: what is running it,
/// the issue it serves, the branch and that branch's state, and — last — whether it can be driven
/// at all.
///
/// One layout rule: **the branch gives way first.** Every other fact holds its width and only the
/// branch is cut, which is also why the branch sits LATE on the line rather than first.
struct SessionHeaderFacts: View {
    @Environment(\.argo) private var argo

    let header: SessionHeaderProjection.Header

    /// Where each fact falls on the line. `presence` and `body` must both follow this order.
    private enum Position: Int, CaseIterable {
        case agent, issue, checkout, access
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.snug) {
            agent
            issue
            checkout
            access
        }
    }

    /// Which facts this Session actually has, in the order above.
    private var presence: [Bool] {
        [header.agent != nil, header.issue != nil, header.checkout != nil, header.access != nil]
    }

    /// Whether anything before this fact is actually on the line — a dot with nothing on one side
    /// of it would open the line on a stray mark.
    private func preceded(_ position: Position) -> Bool {
        presence.prefix(position.rawValue).contains(true)
    }

    /// The branch under the mark that says which kind of checkout it is — a plain branch, or the
    /// two stacked planes of a worktree. The counts ride INSIDE this group, unseparated.
    ///
    /// The one flexible thing on the line — `ArgoMarkedName` carries how a name that long is cut.
    @ViewBuilder private var checkout: some View {
        if let checkout = header.checkout {
            separated(by: preceded(.checkout)) {
                // A step wider than the gap INSIDE the branch group, so the counts read as
                // hanging off the branch rather than as more of its name.
                HStack(spacing: ArgoSpacing.base) {
                    // The mark goes absent, never substituted, when Argo has not read the kind:
                    // drawing the plain one would claim this is not a worktree.
                    ArgoMarkedName(
                        symbol: checkout.symbol,
                        name: checkout.branch,
                        style: ArgoTypography.machineCaption,
                    )
                    .foregroundStyle(argo.color.text.tertiary)
                    .help(checkout.detail)
                    marks
                }
            }
            // BELOW everything else on the line, which holds its width: two unprioritised groups
            // would share a shortfall between them instead of the branch taking all of it.
            .layoutPriority(-1)
        }
    }

    /// What is UNSAVED on the branch, drawn as glyph-and-count, each carrying the sentence that
    /// says what it counts. One rung brighter than the branch: `secondary` against `tertiary`.
    private var marks: some View {
        HStack(spacing: ArgoSpacing.base) {
            // Identified by position, not by symbol: two marks sharing a glyph would collide in
            // the diff and one of them would stop being drawn.
            ForEach(Array(header.marks.enumerated()), id: \.offset) { _, mark in
                HStack(spacing: ArgoSpacing.hair) {
                    ArgoGlyph(mark.symbol, .inline)
                    if let count = mark.count {
                        Text("\(count)")
                            .argoText(ArgoTypography.machineCaption)
                    }
                }
                .help(mark.detail)
            }
        }
        .foregroundStyle(argo.color.text.secondary)
        .layoutPriority(1)
    }

    /// What is running: `Claude Code · Opus 5`, composed by the projection out of whichever of
    /// the two it could establish.
    @ViewBuilder private var agent: some View {
        if let agent = header.agent {
            separated(by: preceded(.agent)) {
                Text(agent)
                    .argoText(ArgoTypography.rowMeta)
                    .foregroundStyle(argo.color.text.tertiary)
                    .lineLimit(1)
            }
        }
    }

    /// Named, never bare — and carrying the issue's own words on hover, where the provider gave
    /// any. There is no attach control beside it: with no provider connected there is nothing to
    /// attach to (`CONTEXT.md` L1).
    ///
    /// The arrow is a CHARACTER in the run rather than an `ArgoGlyph`: an icon rung is an absolute
    /// size and would stand a head above 11pt type, where type takes the label's size and baseline.
    @ViewBuilder private var issue: some View {
        if let issue = header.issue {
            separated(by: preceded(.issue)) {
                Text("\(issue.label) ↗")
                    .argoText(ArgoTypography.rowMeta)
                    .foregroundStyle(argo.color.interaction.accent)
                    .lineLimit(1)
                    .help(issue.detail ?? issue.label)
            }
        }
    }

    /// Whether the Session can be driven — last on the line, and silent for the managed Session.
    /// Which posture is worth a colour was decided by the projection.
    @ViewBuilder private var access: some View {
        if let access = header.access {
            separated(by: preceded(.access)) {
                Text(access.word)
                    .argoText(ArgoTypography.rowMeta)
                    .foregroundStyle(access.tone?.tint(in: argo.color) ?? argo.color.text.tertiary)
                    .lineLimit(1)
                    .help(access.detail)
            }
        }
    }

    /// A fact and the dot that divides it from whatever came before it, holding their width —
    /// which is what makes the branch the one thing on the line that gives.
    ///
    /// The dot is hidden from accessibility: read aloud it is a word in the middle of every fact
    /// a screen reader is already given as a list.
    private func separated(
        by preceded: Bool,
        @ViewBuilder _ fact: () -> some View,
    )
        -> some View {
        HStack(spacing: ArgoSpacing.snug) {
            if preceded {
                Text(verbatim: "·")
                    .argoText(ArgoTypography.rowMeta)
                    .foregroundStyle(argo.color.text.disabled)
                    .accessibilityHidden(true)
            }
            fact()
        }
        .layoutPriority(1)
    }
}

/// Every shape the line takes, one under another — the full set of facts, the Session that has
/// only some of them, and the branch that does not fit.
private struct SessionHeaderFactsGallery: View {
    let width: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.comfortable) {
            ForEach(Array(SessionHeaderFixture.gallery.enumerated()), id: \.offset) { _, header in
                SessionHeaderFacts(header: header)
            }
        }
        .padding(ArgoSpacing.section)
        .frame(width: width, alignment: .leading)
        .argoDeckSurface()
        .argoAppearance()
    }
}

#Preview("Header facts — every shape the line takes") {
    SessionHeaderFactsGallery(width: 900)
}

#Preview("Header facts — at the narrowest deck the window allows") {
    SessionHeaderFactsGallery(width: ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth)
}
