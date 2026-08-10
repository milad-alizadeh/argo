import SwiftUI

/// What the Session is working on and with, on the quiet line under its title: the branch and that
/// branch's state, the CLI and model running it, the issue it serves, and — last — whether it can
/// be driven at all.
///
/// Its own view rather than four more helpers on `SessionHeader`, because the line has one layout
/// rule of its own and it is the whole point of the surface: **the branch gives way first.** A
/// name long enough to fill the line must not cost the facts after it, so everything to the right
/// of the branch holds its width and only the branch is cut.
///
/// The facts are divided by a middle dot rather than by whitespace alone, which is how the
/// approved study draws them. At this size the groups are three or four words with spaces already
/// inside them, and a gap is not a boundary a reader can see.
struct SessionHeaderFacts: View {
    @Environment(\.argo) private var argo

    let header: SessionHeaderProjection.Header

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.snug) {
            checkout
            agent
            issue
            access
        }
    }

    /// Whether anything before each fact is actually on the line. A dot divides two facts; a dot
    /// with nothing on one side of it divides a fact from nothing, which is how a line about a
    /// Session that happens to have no branch would open on a stray mark.
    private var anythingBeforeAgent: Bool {
        header.checkout != nil
    }

    private var anythingBeforeIssue: Bool {
        anythingBeforeAgent || header.agent != nil
    }

    private var anythingBeforeAccess: Bool {
        anythingBeforeIssue || header.issue != nil
    }

    /// The branch under the mark that says which kind of checkout it is — a plain branch, or the
    /// two stacked planes of a worktree. The counts ride INSIDE this group, unseparated: they are
    /// facts about this branch and not a fourth thing on the line.
    ///
    /// The one flexible thing here, cut in the MIDDLE: a real branch name is addressed from both
    /// ends — the ticket number at the head and the slug at the tail — and a tail cut takes the
    /// half that says what the work is.
    @ViewBuilder private var checkout: some View {
        if let checkout = header.checkout {
            HStack(spacing: ArgoSpacing.tight) {
                HStack(spacing: ArgoSpacing.hair) {
                    ArgoGlyph(checkout.symbol, .inline)
                    Text(checkout.branch)
                        .argoText(ArgoTypography.machine)
                        .lineLimit(1)
                        .truncationMode(.middle)
                }
                .help(checkout.detail)
                marks
            }
            .foregroundStyle(argo.color.text.tertiary)
            // BELOW everything else on the line, which takes no priority of its own. Two
            // unprioritised groups share a shortfall between them, and the branch is the one fact
            // here that can afford to lose half of itself.
            .layoutPriority(-1)
        }
    }

    /// Drawn rather than spelled — a pencil with a count and a push-arrow with a count need no
    /// key. Each carries the sentence that says what it counts, because a glyph is a thing you
    /// recognise and not a thing you can be sure of.
    private var marks: some View {
        HStack(spacing: ArgoSpacing.tight) {
            // By position, not by symbol: `ArgoSymbol.uncommitted` is deliberately the same mark
            // the feed spends on an edit, and two marks that ever shared a glyph would collide in
            // the diff and one of them would stop being drawn.
            ForEach(Array(header.marks.enumerated()), id: \.offset) { _, mark in
                HStack(spacing: ArgoSpacing.hair) {
                    ArgoGlyph(mark.symbol, .inline)
                    if let count = mark.count {
                        Text("\(count)")
                            .argoText(ArgoTypography.machine)
                    }
                }
                .help(mark.detail)
            }
        }
        .layoutPriority(1)
    }

    /// What is running: `Claude Code · Opus 5`, composed by the projection out of whichever of
    /// the two it could establish.
    @ViewBuilder private var agent: some View {
        if let agent = header.agent {
            separated(by: anythingBeforeAgent) {
                Text(agent)
                    .argoText(ArgoTypography.caption)
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
    @ViewBuilder private var issue: some View {
        if let issue = header.issue {
            separated(by: anythingBeforeIssue) {
                HStack(spacing: ArgoSpacing.hair) {
                    Text(issue.label)
                        .argoText(ArgoTypography.caption)
                        .lineLimit(1)
                    ArgoGlyph(ArgoSymbol.opensExternally, .inline)
                }
                .foregroundStyle(argo.color.interaction.accent)
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
            separated(by: anythingBeforeAccess) {
                Text(access.word)
                    .argoText(ArgoTypography.caption)
                    .foregroundStyle(ink(for: access.tone))
                    .lineLimit(1)
                    .help(access.detail)
            }
        }
    }

    private func ink(for tone: SessionHeaderProjection.AccessTone) -> ArgoColor {
        switch tone {
        case .quiet: argo.color.text.tertiary
        case .attention: argo.color.state.attention
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
                Text(verbatim: "·")
                    .argoText(ArgoTypography.caption)
                    .foregroundStyle(argo.color.text.tertiary)
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
