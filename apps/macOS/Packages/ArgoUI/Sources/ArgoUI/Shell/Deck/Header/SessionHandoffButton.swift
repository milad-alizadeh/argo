import SwiftUI

/// The remedy, beside the reading that asks for it.
///
/// It draws an offer it was handed and judges nothing: whether there is one at all, and how urgent
/// it is, are `SessionHeaderProjection.handoff(from:)`'s. What lives here is the ink each answer
/// wears — and the ink is the TIER's, borrowed from the reading two inches away, so the button and
/// the number it is about cannot end up two different alarms.
///
/// **No caption.** The verb is the whole control (#502, story 46); the coloured reading beside it
/// and the ⓘ above it have already said what handing off is for, and a third telling would make the
/// header a paragraph.
struct SessionHandoffButton: View {
    @Environment(\.argo) private var argo

    let handoff: SessionHeaderProjection.Handoff
    let run: () -> Void

    var body: some View {
        Button(action: run) {
            Text(handoff.label)
                .argoText(ArgoTypography.caption)
                .foregroundStyle(ink)
                .lineLimit(1)
                .padding(.horizontal, ArgoSpacing.snug)
                .padding(.vertical, ArgoSpacing.hair)
                // The ground is the neutral step every float lands on, exactly as `ArgoBadge`'s is:
                // this palette rations hue for MEANING, so the tier's colour is spent on the word
                // and the rim that carries it and never on a filled patch of alarm at the top of
                // the deck.
                .background(argo.color.surface.overlay, in: .capsule)
                .overlay {
                    Capsule().strokeBorder(ink, lineWidth: ArgoStroke.border)
                }
        }
        .buttonStyle(.plain)
        .disabled(!handoff.isLaunchable)
        // The reason travels with the control rather than being left to whatever surface happens to
        // draw a tooltip: a remedy that is out of reach has to say what is in its way.
        .help(handoff.blocked ?? handoff.detail)
        .accessibilityLabel(handoff.label)
        .accessibilityHint(handoff.blocked ?? handoff.detail)
        // It must survive a title long enough to need cutting: the branch is what gives way on this
        // line (#502, story 25), never the remedy.
        .layoutPriority(1)
    }

    /// The tier's own tint, at full strength — this is a CONTROL, and the quietening the reading
    /// gets at `okay` has no case here: a button only exists past a line.
    private var ink: ArgoColor {
        handoff.isLaunchable
            ? handoff.tier.tint(in: argo.color)
            : argo.color.text.disabled
    }
}

#Preview("Hand off — amber, red, and out of reach") {
    VStack(alignment: .leading, spacing: ArgoSpacing.section) {
        ForEach(Array(SessionHeaderFixture.handoffOffers.enumerated()), id: \.offset) { offer in
            SessionHandoffButton(handoff: offer.element, run: {})
        }
    }
    .padding(ArgoSpacing.region)
    .argoDeckSurface()
    .argoAppearance()
}
