import SwiftUI

/// The glass vessel the user speaks to a Session through — the field, the footer, and the seam
/// that carries a refusal.
///
/// It floats over the feed rather than sitting in an attached seam: the deck's bottom edge
/// belongs to the reading, and the vessel is a state the reader is in — there is something to
/// say — which is exactly what `ArgoFloatingGlass` spells. Acceptance is the echo, not a toast:
/// the field clears and the words come back as the user's own row in the feed, so success draws
/// nothing here at all.
struct SessionComposer: View {
    let composer: SessionComposerProjection.Composer
    /// One Turn to the Session, or a thrown `SessionDriveError` the seam repeats. A closure and
    /// not a driver, so the vessel renders from a preview or a specimen with nothing behind it.
    let send: (String) throws -> Void
    /// Take back a standing allow, by tool (#572). A closure for the reason `send` is.
    let revoke: (String) -> Void

    @State private var draft: ComposerDraft
    @State private var mode: ComposerMode = .code

    init(
        composer: SessionComposerProjection.Composer,
        send: @escaping (String) throws -> Void,
        revoke: @escaping (String) -> Void = { _ in },
        draft: ComposerDraft = ComposerDraft(),
    ) {
        self.composer = composer
        self.send = send
        self.revoke = revoke
        _draft = State(initialValue: draft)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            if let refusal = draft.refusal {
                ComposerSeam(detail: refusal, retry: submit)
            }
            vessel
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Composer")
    }

    private var vessel: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            if !composer.standingAllows.isEmpty {
                StandingAllowTray(allows: composer.standingAllows, revoke: revoke)
            }
            ComposerField(text: $draft.text, placeholder: composer.placeholder, submit: submit)
            ComposerFooter(
                mode: $mode,
                facts: composer.facts,
                isSendable: draft.isSendable,
                send: submit,
            )
        }
        // Asymmetric on purpose: the trailing edge ends in a 26pt control and the leading edge
        // in text, so the two are held off the rim by different amounts.
        .padding(.top, ArgoSpacing.comfortable)
        .padding(.leading, ArgoSpacing.loose)
        .padding(.trailing, ArgoSpacing.base)
        .padding(.bottom, ArgoSpacing.base)
        .argoFloatingGlass(in: RoundedRectangle(cornerRadius: ArgoRadius.popover))
    }

    /// Guarded rather than left to the driver's refusal: Return lands here from an empty field
    /// too, and a bare Return at a live prompt is the one keystroke the composer must never leak.
    private func submit() {
        guard draft.isSendable else { return }
        draft.send(via: send)
    }
}

#Preview("Composer — at rest") {
    SessionComposer(composer: ComposerSpecimen.composer, send: { _ in })
        .padding(ArgoSpacing.section)
        .frame(width: 760)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Composer — holding a draft") {
    SessionComposer(
        composer: ComposerSpecimen.composer,
        send: { _ in },
        draft: ComposerSpecimen.typing,
    )
    .padding(ArgoSpacing.section)
    .frame(width: 760)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Composer — a send the Session refused") {
    SessionComposer(
        composer: ComposerSpecimen.composer,
        send: { _ in },
        draft: ComposerSpecimen.refused,
    )
    .padding(ArgoSpacing.section)
    .frame(width: 760)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Composer — holding standing allows") {
    SessionComposer(composer: ComposerSpecimen.standing, send: { _ in })
        .padding(ArgoSpacing.section)
        .frame(width: 760)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Composer — the Reduce Transparency fallback") {
    SessionComposer(composer: ComposerSpecimen.composer, send: { _ in })
        .padding(ArgoSpacing.section)
        .frame(width: 760)
        .argoWithoutTransparency()
        .argoDeckSurface()
        .argoAppearance()
}
