import SwiftUI

/// The deck's top zone: the Session's own title, what you can do with it when that is not the
/// default, and the facts that say what it is working on and with — its branch and that branch's
/// state, its CLI and model, and the issue it serves.
///
/// It draws no ground and no rule of its own — the deck is one opaque plane, and the approved study
/// puts no separator between the header and the tabs beneath it.
///
/// The facts sit UNDER the title, not beside it
/// (`docs/designs/prototypes/roster-header-prototype.html`, variant A).
struct SessionHeader: View {
    @Environment(\.argo) private var argo

    /// Absent when nothing is selected. The zone still holds its height: the deck's rhythm is the
    /// plane's, not the Session's, and a header collapsing would move every zone under it.
    let header: SessionHeaderProjection.Header?
    /// Hand this Session's work to a fresh one; the sequence behind it is `SessionHandoff`'s. Inert
    /// by default, so a specimen draws the button and spawns nothing. `async` because it is
    /// answered in minutes and the control has to hold itself for that long.
    var handOff: () async -> Void = {}

    var body: some View {
        // Centred rather than baseline-aligned: the instrument on the trailing edge is a bar with
        // no baseline, and the identity beside it is two stacked lines with no single one.
        HStack(alignment: .center, spacing: ArgoSpacing.comfortable) {
            identity
                // Combined here and NOT over the whole header: combining over the instrument would
                // swallow its ⓘ, and a control nothing can address is a panel nobody can open.
                .accessibilityElement(children: .combine)
                .accessibilityLabel(header?.announcement ?? "No Session selected")
                // Above the Spacer, which otherwise takes the slack first and cuts a title that
                // had room.
                .layoutPriority(1)
            Spacer(minLength: ArgoSpacing.loose)
            if let header {
                if let state = header.state {
                    stateWord(state)
                }
                // Before the instrument, so the instrument keeps the trailing edge it is measured
                // against.
                if let handoff = header.handoff {
                    SessionHandoffButton(handoff: handoff, run: handOff)
                }
                SessionHeaderContext(context: header.context)
            }
        }
        .padding(.horizontal, ArgoSpacing.section)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .accessibilityElement(children: .contain)
    }

    /// Tight on purpose: the title and the line under it are ONE identity.
    private var identity: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
            if let header {
                title(header)
                SessionHeaderFacts(header: header)
            }
        }
    }

    /// What the Session is waiting for, level with the title (`docs/designs/composer/perm.png`),
    /// and outside the identity element so a screen reader hears it as a separate claim.
    private func stateWord(_ state: SessionState.Reading) -> some View {
        Text(state.word)
            .argoText(ArgoTypography.rowMeta)
            .foregroundStyle(state.tone?.tint(in: argo.color) ?? argo.color.text.tertiary)
            .lineLimit(1)
    }

    /// Cut at the TAIL: a Session's title is written subject first, so its front tells two of them
    /// apart.
    private func title(_ header: SessionHeaderProjection.Header) -> some View {
        Text(header.title)
            .argoText(ArgoTypography.sessionTitle)
            .foregroundStyle(argo.color.text.primary)
            .lineLimit(1)
            .truncationMode(.tail)
    }
}

/// Every posture in one gallery, with nothing-selected drawn under them: an empty zone and a zone
/// with no mark on it are two different absences.
private struct SessionHeaderGallery: View {
    let width: CGFloat

    private var headers: [SessionHeaderProjection.Header] {
        SessionHeaderFixture.headers + [SessionHeaderFixture.needsInput]
    }

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            ForEach(Array(headers.enumerated()), id: \.offset) { _, header in
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

// The width real titles are cut at.
#Preview("Session header — at the narrowest deck the window allows") {
    SessionHeaderGallery(width: ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth)
}
