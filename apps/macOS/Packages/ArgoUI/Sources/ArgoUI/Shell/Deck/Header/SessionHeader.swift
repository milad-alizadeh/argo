import SwiftUI

/// The deck's top zone: the Session's own title, and — only when it is not a plain managed
/// Session — what you can do with it.
///
/// It draws no ground and no rule of its own. The deck is one opaque plane and the header reads as
/// one region with the tabs beneath it, which is why the approved study puts no separator between
/// the two.
///
/// The mark beside the title is set as words rather than as a chip, which is how the study draws
/// it. A second badge drawn by hand is the shape `ArgoBadge` warns about, and the primitive it
/// would be borrowed from carries a COUNT — a capsule around one quiet word would be louder than
/// the fact deserves at the top of every read-only reading.
struct SessionHeader: View {
    @Environment(\.argo) private var argo

    /// Absent when nothing is selected. The zone still holds its height: the deck's rhythm is the
    /// plane's, not the Session's, and a header collapsing would move every zone under it.
    let header: SessionHeaderProjection.Header?

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: ArgoSpacing.comfortable) {
            if let header {
                title(header)
                mark(header)
                branch(header)
            }
            // The trailing space the later header tickets fill — the branch's state, the CLI and
            // model, the linked issue, and the context reading on the right edge.
            Spacer(minLength: ArgoSpacing.loose)
        }
        .padding(.horizontal, ArgoSpacing.section)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(header?.announcement ?? "No Session selected")
    }

    /// The largest interface line in the cockpit, and the one thing on the header that is allowed
    /// to take the room it needs — cut at the tail, because a Session's title is written subject
    /// first and the front of it is what tells two of them apart.
    private func title(_ header: SessionHeaderProjection.Header) -> some View {
        Text(header.title)
            .argoText(ArgoTypography.sessionTitle)
            .foregroundStyle(argo.color.text.primary)
            .lineLimit(1)
            .truncationMode(.tail)
    }

    /// The branch. A ref is addressed from both ends — the ticket at the head, the subject at the
    /// tail — so where the line cannot hold one it is cut at the middle, which is the part that
    /// repeats across every branch in a repo.
    ///
    /// Under the glyph the vessel already spends on a branch, so the header and the toolbar name
    /// the same kind of thing the same way — and so the ref needs no word introducing it.
    @ViewBuilder private func branch(_ header: SessionHeaderProjection.Header) -> some View {
        if let branch = header.branch {
            Label {
                Text(branch)
            } icon: {
                ArgoGlyph(ArgoSymbol.branch, .inline)
            }
            .labelStyle(.argo(ArgoTypography.control))
            .foregroundStyle(argo.color.text.secondary)
            .lineLimit(1)
            .truncationMode(.middle)
        }
    }

    /// Quiet by construction: the mark says the Session is one you cannot drive, which is worth
    /// reading once and never worth competing with the title beside it.
    ///
    /// Set in capitals, which is the study's treatment and a property of the TYPE rather than of
    /// the vocabulary — the word itself, and the sentence explaining it, are the projection's.
    @ViewBuilder private func mark(_ header: SessionHeaderProjection.Header) -> some View {
        if let access = header.access {
            Text(access.word)
                .argoText(ArgoTypography.caption)
                .textCase(.uppercase)
                .foregroundStyle(argo.color.text.tertiary)
                .lineLimit(1)
                .help(access.detail)
                // It must survive a title long enough to need cutting: a fact that disappears at
                // the width real titles reach is a fact drawn only in fixtures.
                .layoutPriority(1)
        }
    }
}

/// Every posture in one gallery — the silent one included, which is why nothing selected is drawn
/// under them: an empty zone and a zone with no mark on it are two different absences.
private struct SessionHeaderGallery: View {
    let width: CGFloat

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            ForEach(Array(SessionHeaderFixture.headers.enumerated()), id: \.offset) { _, header in
                SessionHeader(header: header)
                    .frame(height: ArgoLayout.deckHeaderHeight)
            }
            SessionHeader(header: nil)
                .frame(height: ArgoLayout.deckHeaderHeight)
        }
        .frame(width: width)
        .argoDeckSurface()
        .argoAppearance()
    }
}

#Preview("Session header — every access posture, and nothing selected") {
    SessionHeaderGallery(width: 900)
}

// The width real titles are cut at: a mark that survives only in a wide window is a mark drawn
// for fixtures.
#Preview("Session header — at the narrowest deck the window allows") {
    SessionHeaderGallery(width: ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth)
}
