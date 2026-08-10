import SwiftUI

/// The deck's top zone: the Session's own title, what you can do with it when that is not the
/// default, and the facts that say what it is working on and with — its branch and that branch's
/// state, its CLI and model, and the issue it serves.
///
/// It draws no ground and no rule of its own. The deck is one opaque plane and the header reads as
/// one region with the tabs beneath it, which is why the approved study puts no separator between
/// the two.
///
/// The facts sit UNDER the title, not beside it, which is what the approved study draws
/// (`docs/designs/prototypes/roster-header-prototype.html`, variant A). Beside it, the title and
/// the facts compete for one line's width at every window size, and the title — the largest line
/// in the cockpit and the thing the zone exists to say — is the one that loses. Stacked, the title
/// gets the whole width and the facts get their own.
struct SessionHeader: View {
    @Environment(\.argo) private var argo

    /// Absent when nothing is selected. The zone still holds its height: the deck's rhythm is the
    /// plane's, not the Session's, and a header collapsing would move every zone under it.
    let header: SessionHeaderProjection.Header?

    var body: some View {
        HStack(alignment: .top, spacing: ArgoSpacing.comfortable) {
            if let header {
                // Tight on purpose: the title and the line under it are ONE identity, and a step
                // of the ordinary rhythm between them would read as two stacked regions.
                VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
                    title(header)
                    SessionHeaderFacts(header: header)
                }
            }
            // The trailing space the later header tickets fill — the context reading on the
            // right edge, and what it offers to do about it.
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
