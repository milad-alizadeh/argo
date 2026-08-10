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
    /// Hand this Session's work to a fresh one. A closure and not a whole action set, for the
    /// reason `GitVessel` takes `refresh:` — the header raises one intent, and the sequence behind
    /// it is `SessionHandoff`'s. Inert by default, which is what a specimen and a `#Preview` want:
    /// the button is drawn and nothing is spawned.
    ///
    /// `async` because it is answered in minutes rather than instantly, and the control has to hold
    /// itself for exactly as long as that takes.
    var handOff: () async -> Void = {}

    var body: some View {
        // Centred rather than baseline-aligned, because only one half of this line is type: the
        // instrument on the trailing edge is a reading over a bar, and a bar has no baseline to
        // sit on. The identity beside it is two stacked lines, which has no one baseline either.
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

    /// Tight on purpose: the title and the line under it are ONE identity, and a step of the
    /// ordinary rhythm between them would read as two stacked regions.
    private var identity: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.hair) {
            if let header {
                title(header)
                SessionHeaderFacts(header: header)
            }
        }
    }

    /// What the Session is waiting for, on the band's trailing side and level with the title —
    /// where the approved render puts it (`docs/designs/composer/perm.png`), and outside the
    /// identity element so a screen reader hears it as the separate claim it is rather than as a
    /// second reading of the title's own line.
    ///
    /// The word takes the state's own ink, as the roster row's does: `Needs input` is a "come
    /// here", and the amber is what makes it one from across the window.
    private func stateWord(_ state: SessionState.Reading) -> some View {
        Text(state.word)
            .argoText(ArgoTypography.rowMeta)
            .foregroundStyle(state.tone?.tint(in: argo.color) ?? argo.color.text.tertiary)
            .lineLimit(1)
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
/// under them: an empty zone and a zone with no mark on it are two different absences. The Session
/// blocked on a Permission closes the set: its word is the only one the band ever spends, and a
/// word that only reads as loud on its own is not the signal the render was approved for.
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

// The width real titles are cut at: a mark that survives only in a wide window is a mark drawn
// for fixtures.
#Preview("Session header — at the narrowest deck the window allows") {
    SessionHeaderGallery(width: ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth)
}
