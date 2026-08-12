import SwiftUI

/// The tab line's trailing group (#693, `docs/designs/cockpit-session-header.md`): what the Session
/// is waiting for, the one instrument, and the remedy when there is one.
///
/// It is the whole of what the deleted identity band carried. The identity itself — the title and
/// the fact line under it — is the window's document title and that title's hover (#692), so
/// nothing here restates a fact drawn up there.
struct TabLineInstruments: View {
    @Environment(\.argo) private var argo

    /// Absent when nothing is selected. The group draws nothing then, and the line keeps its own
    /// height regardless — every zone below the canopy is inset by it.
    let header: SessionHeaderProjection.Header?
    /// Hand this Session's work to a fresh one; the sequence behind it is `SessionHandoff`'s. Inert
    /// by default, so a specimen draws the button and spawns nothing. `async` because it is
    /// answered in minutes and the control has to hold itself for that long.
    var handOff: () async -> Void = {}

    var body: some View {
        // Centred rather than baseline-aligned: the instrument is a bar with no baseline of
        // its own.
        HStack(alignment: .center, spacing: ArgoSpacing.loose) {
            if let header {
                if let state = header.state {
                    stateWord(state)
                }
                SessionHeaderContext(context: header.context)
                // LAST, so the remedy takes the trailing edge the design gives it. The instrument
                // slides inward when the button appears, which the design accepts: the movement is
                // itself the signal that a line was crossed.
                if let handoff = header.handoff {
                    SessionHandoffButton(handoff: handoff, run: handOff)
                }
            }
        }
        .accessibilityElement(children: .contain)
    }

    /// What the Session is waiting for (`docs/designs/composer/perm.png`), and its own element so a
    /// screen reader hears it as a separate claim from the title in the titlebar.
    private func stateWord(_ state: SessionState.Reading) -> some View {
        Text(state.word)
            .argoText(ArgoTypography.rowMeta)
            .foregroundStyle(state.tone?.tint(in: argo.color) ?? argo.color.text.tertiary)
            .lineLimit(1)
    }
}

/// Every posture in one gallery, with nothing-selected drawn under them: an empty line and a line
/// with no mark on it are two different absences.
private struct TabLineInstrumentsGallery: View {
    let width: CGFloat

    private var headers: [SessionHeaderProjection.Header] {
        SessionHeaderFixture.headers + [SessionHeaderFixture.needsInput]
    }

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            ForEach(Array(headers.enumerated()), id: \.offset) { _, header in
                SessionTabLine(header: header)
                    .frame(height: ArgoLayout.deckTabSlotHeight)
            }
            SessionTabLine(header: nil)
                .frame(height: ArgoLayout.deckTabSlotHeight)
        }
        .frame(width: width)
        .argoDeckSurface()
        .argoAppearance()
    }
}

#Preview("Tab line instruments — every access posture, and nothing selected") {
    TabLineInstrumentsGallery(width: 900)
}

// The width the instruments are squeezed to when the tabs beside them have a real width.
#Preview("Tab line instruments — at the narrowest deck the window allows") {
    TabLineInstrumentsGallery(width: ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth)
}
