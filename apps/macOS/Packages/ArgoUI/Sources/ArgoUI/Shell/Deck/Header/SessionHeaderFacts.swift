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
            trailing(header.agent)
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
        }
    }

    /// Drawn rather than spelled — a pencil with a count and a push-arrow with a count need no
    /// key. Each carries the sentence that says what it counts, because a glyph is a thing you
    /// recognise and not a thing you can be sure of.
    private var marks: some View {
        HStack(spacing: ArgoSpacing.base) {
            ForEach(header.marks, id: \.symbol) { mark in
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
            trailing(issue.label)
                .help(issue.detail ?? issue.label)
        }
    }

    /// A fact that holds its width. Everything after the branch is drawn this way, which is what
    /// makes the branch the thing that gives.
    @ViewBuilder private func trailing(_ text: String?) -> some View {
        if let text {
            Text(text)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(argo.color.text.tertiary)
                .lineLimit(1)
                .layoutPriority(1)
        }
    }
}
