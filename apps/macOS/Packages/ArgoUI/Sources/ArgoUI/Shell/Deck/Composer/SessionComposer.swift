import SwiftUI

/// The glass vessel the user speaks to a Session through — the field, what is waiting above it,
/// the footer, and the seam that carries a refusal or says the draft was kept.
///
/// Acceptance is the echo, not a toast: the field clears and the words come back as the user's own
/// row in the feed, so success draws nothing here at all.
///
/// The draft is a BINDING and not state of its own: what the user typed lives in `ComposerDrafts`,
/// keyed by Session, so leaving and coming back finds it where it was.
struct SessionComposer: View {
    let composer: SessionComposerProjection.Composer
    /// One Turn to the Session, or a thrown `SessionDriveError` the seam repeats. A closure and
    /// not a driver, so the vessel renders from a preview or a specimen with nothing behind it.
    let send: (String) throws -> Void
    /// Take back a standing allow, by tool (#572). A closure for the reason `send` is.
    let revoke: (String) -> Void
    @Binding var draft: ComposerDraft

    @State private var mode: ComposerMode = .code
    /// When this Session's composer came on screen — both the moment a restored draft's age is
    /// measured against and the test for whether it IS restored. Anything the user has typed since
    /// stamps later than this and takes the seam away.
    @State private var enteredAtMs = 0

    init(
        composer: SessionComposerProjection.Composer,
        send: @escaping (String) throws -> Void,
        revoke: @escaping (String) -> Void = { _ in },
        draft: Binding<ComposerDraft> = .constant(ComposerDraft()),
    ) {
        self.composer = composer
        self.send = send
        self.revoke = revoke
        _draft = draft
    }

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            if let note = seamNote {
                ComposerSeam(note: note, retry: retry)
            }
            vessel
        }
        .onChange(of: composer.sessionID, initial: true) { _, _ in
            enteredAtMs = WallClock.nowMs()
        }
        // The Turn the queue was waiting on has ended, so what was held goes, in the order it was
        // typed. `initial` is what makes it survive a switch: the composer is only on screen for
        // the SELECTED Session, so a Turn that ends while the reader is looking elsewhere changes
        // nothing here, and flushing on arrival delivers what was waiting.
        .onChange(of: composer.isRunning, initial: true) { _, isRunning in
            guard !isRunning else { return }
            draft.flush(via: send)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Composer")
    }

    private var vessel: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            if !composer.standingAllows.isEmpty {
                StandingAllowTray(allows: composer.standingAllows, revoke: revoke)
            }
            queue
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

    /// What is waiting on the running Turn, oldest at the top — the order they will go in, drawn
    /// as the order they are read in.
    @ViewBuilder private var queue: some View {
        if !draft.queued.isEmpty {
            VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
                ForEach(draft.queued) { turn in
                    QueuedTurnChip(turn: turn) { draft.cancel(turn.id) }
                }
            }
            .padding(.bottom, ArgoSpacing.snug)
        }
    }

    /// A refusal outranks a kept draft — the seam is one line. The kept note holds only until the
    /// user types: their own edit stamps later than the moment they arrived.
    private var seamNote: ComposerSeamNote? {
        if let refusal = draft.refusal {
            return .refusal(refusal)
        }
        guard !draft.text.isEmpty, let editedAtMs = draft.editedAtMs, editedAtMs < enteredAtMs
        else { return nil }
        return ComposerSeamNote.kept(sinceMs: editedAtMs, nowMs: enteredAtMs)
    }

    /// Sent now, or queued behind the Turn in flight — `ComposerDraft` owns which, so the field
    /// and the send control ask for the same thing.
    private func submit() {
        draft.submit(whileRunning: composer.isRunning, via: send)
    }

    /// The seam's remedy, which is not the same act as pressing send: what it puts back is
    /// whatever the refusal stopped, and after a refused flush that is the queue, not the field.
    private func retry() {
        draft.retry(via: send)
    }
}

#Preview("Composer — at rest") {
    @Previewable @State var draft = ComposerDraft()

    ComposerPreview(composer: ComposerSpecimen.composer, draft: $draft)
}

#Preview("Composer — holding a draft") {
    @Previewable @State var draft = ComposerSpecimen.typing

    ComposerPreview(composer: ComposerSpecimen.composer, draft: $draft)
}

#Preview("Composer — a send the Session refused") {
    @Previewable @State var draft = ComposerSpecimen.refused

    ComposerPreview(composer: ComposerSpecimen.composer, draft: $draft)
}

#Preview("Composer — a follow-up queued behind a running Turn") {
    @Previewable @State var draft = ComposerSpecimen.queued

    ComposerPreview(composer: ComposerSpecimen.running, draft: $draft)
}

#Preview("Composer — holding standing allows") {
    @Previewable @State var draft = ComposerDraft()

    ComposerPreview(composer: ComposerSpecimen.standing, draft: $draft)
}

#Preview("Composer — the Reduce Transparency fallback") {
    @Previewable @State var draft = ComposerDraft()

    SessionComposer(composer: ComposerSpecimen.composer, send: { _ in }, draft: $draft)
        .padding(ArgoSpacing.section)
        .frame(width: 760)
        .argoWithoutTransparency()
        .argoDeckSurface()
        .argoAppearance()
}

/// The frame every composer preview draws in.
private struct ComposerPreview: View {
    let composer: SessionComposerProjection.Composer
    @Binding var draft: ComposerDraft

    var body: some View {
        SessionComposer(composer: composer, send: { _ in }, draft: $draft)
            .padding(ArgoSpacing.section)
            .frame(width: 760)
            .argoDeckSurface()
            .argoAppearance()
    }
}
