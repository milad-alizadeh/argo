import SwiftUI

/// What the Session is working on and with, beside its title: the branch and that branch's state,
/// the CLI and model running it, and the issue it serves.
///
/// Its own view rather than four more helpers on `SessionHeader`, because the line has one layout
/// rule of its own and it is the whole point of the surface: **the branch gives way first.** A
/// name long enough to fill the line must not cost the facts after it, so everything to the right
/// of the branch holds its width and only the branch is cut.
struct SessionHeaderFacts: View {
    @Environment(\.argo) private var argo

    let header: SessionHeaderProjection.Header

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.comfortable) {
            branch
            marks
            fixedFact(header.agent)
            issue
        }
    }

    /// The one flexible thing on the line, cut in the MIDDLE: a real branch name is addressed
    /// from both ends — the ticket number at the head and the slug at the tail — and a tail cut
    /// takes the half that says what the work is.
    @ViewBuilder private var branch: some View {
        if let branch = header.branch {
            HStack(spacing: ArgoSpacing.tight) {
                ArgoGlyph(ArgoSymbol.branch, .inline)
                Text(branch)
                    .argoText(ArgoTypography.machine)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            .foregroundStyle(argo.color.text.secondary)
            .help(branch)
            // BELOW the title, which takes no priority of its own. Two unprioritised texts on
            // one line share the shortfall between them, so the title would be cut alongside the
            // branch — and the branch is the fact this line can most afford to lose half of.
            .layoutPriority(-1)
        }
    }

    /// Drawn rather than spelled — a pencil with a count and a push-arrow with a count need no
    /// key. Each carries the sentence that says what it counts, because a glyph is a thing you
    /// recognise and not a thing you can be sure of.
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
                            .argoText(ArgoTypography.machine)
                    }
                }
                .help(mark.detail)
            }
        }
        .foregroundStyle(argo.color.text.tertiary)
        .layoutPriority(1)
    }

    /// Named, never bare — and carrying the issue's own words on hover, where the provider gave
    /// any. There is no attach control beside it: with no provider connected there is nothing to
    /// attach to (`CONTEXT.md` L1).
    @ViewBuilder private var issue: some View {
        if let issue = header.issue {
            fixedFact(issue.label)
                .help(issue.detail ?? issue.label)
        }
    }

    /// A fact that holds its width. Everything after the branch is drawn this way, which is what
    /// makes the branch the thing that gives.
    @ViewBuilder private func fixedFact(_ text: String?) -> some View {
        if let text {
            Text(text)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.tertiary)
                .lineLimit(1)
                .layoutPriority(1)
        }
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
