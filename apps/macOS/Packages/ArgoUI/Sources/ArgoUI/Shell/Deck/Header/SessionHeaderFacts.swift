import SwiftUI

/// What the Session is working on and with, on the quiet line under its title: what is running it,
/// the issue it serves, the branch and that branch's state, and — last — whether it can be driven
/// at all.
///
/// Its own view rather than four more helpers on `SessionHeader`, because the line has one layout
/// rule of its own and it is the whole point of the surface: **the branch gives way first.** A
/// name long enough to fill the line must not cost the facts after it, so every other fact holds
/// its width and only the branch is cut.
///
/// Which is also why the branch sits LATE rather than first. The facts that never change length —
/// the CLI, the model, the issue number — read in the same place on every Session, and the one
/// that varies from eight characters to forty is put where its variation costs the others nothing.
///
/// The facts are divided by a middle dot rather than by whitespace alone, which is how the
/// approved study draws them. At this size the groups are three or four words with spaces already
/// inside them, and a gap is not a boundary a reader can see.
struct SessionHeaderFacts: View {
    @Environment(\.argo) private var argo

    let header: SessionHeaderProjection.Header

    /// Where each fact falls on the line. The order is here, once, rather than implied by the
    /// order of four `if`s and restated by three booleans that have to agree with them.
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

    /// Whether anything before this fact is actually on the line. A dot divides two facts; a dot
    /// with nothing on one side of it divides a fact from nothing, which is how a line about a
    /// Session with no CLI on record would open on a stray mark.
    private func preceded(_ position: Position) -> Bool {
        presence.prefix(position.rawValue).contains(true)
    }

    /// The branch under the mark that says which kind of checkout it is — a plain branch, or the
    /// two stacked planes of a worktree. The counts ride INSIDE this group, unseparated: they are
    /// facts about this branch and not a fourth thing on the line.
    ///
    /// The one flexible thing on the line — `ArgoMarkedName` carries how a name that long is cut.
    @ViewBuilder private var checkout: some View {
        if let checkout = header.checkout {
            separated(by: preceded(.checkout)) {
                // A step wider than the gap INSIDE the branch group, so the counts read as
                // hanging off the branch rather than as more of its name.
                HStack(spacing: ArgoSpacing.base) {
                    // The mark goes absent, never substituted, when Argo has not read the kind: it
                    // is the only thing that tells a worktree from the Project's own checkout, so
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
            // BELOW everything else on the line, which holds its width. Two unprioritised groups
            // share a shortfall between them, and the branch is the one fact here that can afford
            // to lose half of itself.
            .layoutPriority(-1)
        }
    }

    /// Drawn rather than spelled — a pencil with a count and a push-arrow with a count need no
    /// key. Each carries the sentence that says what it counts, because a glyph is a thing you
    /// recognise and not a thing you can be sure of.
    ///
    /// One step brighter than the branch they sit against, as the study sets them: the branch is
    /// where the Session is, and these are what is UNSAVED there.
    private var marks: some View {
        HStack(spacing: ArgoSpacing.base) {
            // By position, not by symbol: `ArgoSymbol.uncommitted` is deliberately the same mark
            // the feed spends on an edit, and two marks that ever shared a glyph would collide in
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
    /// Set in Ion Blue under the mark that says where it leads, which is the study's treatment.
    /// The two travel together on purpose — the colour alone would say only that something here
    /// is special.
    ///
    /// The arrow is a CHARACTER in the run rather than an `ArgoGlyph`, as the study writes it. An
    /// icon rung is an absolute size and would stand a head above 11pt type; set as type it takes
    /// the label's own size and baseline, which is what "beside the words" means here.
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

    /// Last on the line, because it is the only fact here that is about the READER rather than
    /// about the work — and silent for the managed Session, which is most of them.
    ///
    /// Which of the two postures is worth a colour was decided by the projection: a Session Argo
    /// LOST is the one worth finding, and one it never owned is an ordinary thing to be reading.
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

    /// A fact and the dot that divides it from whatever came before it, drawn together so the two
    /// can never come apart — and holding their width, which is what makes the branch the one
    /// thing on the line that gives.
    ///
    /// The dot is hidden from accessibility: it is punctuation between facts a screen reader is
    /// already given as a list, and read aloud it is a word in the middle of every one of them.
    private func separated(
        by preceded: Bool,
        @ViewBuilder _ fact: () -> some View,
    )
        -> some View {
        HStack(spacing: ArgoSpacing.snug) {
            if preceded {
                // Dimmer than the facts either side of it, as the study sets it: punctuation that
                // reads as loudly as the words is a third fact between every two.
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
/// only some of them, and the branch that does not fit. The three are only judgeable as a group:
/// what the line has to prove is that the same facts sit in the same places whichever of them a
/// Session happens to have.
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
