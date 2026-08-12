import SwiftUI

/// The deck's top zone, since the title left it for the titlebar (#692): what the Session is
/// waiting for, what you can do with it when that is not the default, and the one instrument.
///
/// The identity it used to carry — the title and the fact line under it — is the window's document
/// title and that title's hover now. Nothing here restates a fact drawn up there.
///
/// It draws no ground and no rule of its own — the deck is one opaque plane, and the approved study
/// puts no separator between the header and the tabs beneath it.
///
/// The band survives this move shrunken rather than deleted; deleting it is #693's.
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
        // no baseline of its own.
        HStack(alignment: .center, spacing: ArgoSpacing.comfortable) {
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

    /// What the Session is waiting for (`docs/designs/composer/perm.png`), and its own element so a
    /// screen reader hears it as a separate claim from the title above it.
    private func stateWord(_ state: SessionState.Reading) -> some View {
        Text(state.word)
            .argoText(ArgoTypography.rowMeta)
            .foregroundStyle(state.tone?.tint(in: argo.color) ?? argo.color.text.tertiary)
            .lineLimit(1)
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
