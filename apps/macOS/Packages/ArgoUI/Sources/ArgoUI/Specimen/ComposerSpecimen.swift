import ArgoEngine
import SwiftUI

/// The composer's own states — typing, a refused send, a kept draft, a queued follow-up — at the
/// width the feed column gives the vessel. The composed state (glass over a real reading, the fade
/// under it) is the deck's case; what these add is what only the vessel itself can show.
struct ComposerSpecimen: View {
    let composer: SessionComposerProjection.Composer

    /// Where the window's opening focus is parked. Left to itself the field is the first key
    /// view, and macOS select-alls a focused field's text — which renders a draft as a selection,
    /// a state this case is not about.
    @FocusState private var parked: Bool
    /// The vessel writes through a binding now, so a case that renders one has to hold the value.
    @State private var held: ComposerDraft

    init(
        composer: SessionComposerProjection.Composer = ComposerSpecimen.composer,
        draft: ComposerDraft = ComposerDraft(),
    ) {
        self.composer = composer
        _held = State(initialValue: draft)
    }

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            Color.clear
                .frame(height: ArgoStroke.border)
                .focusable()
                .focused($parked)
                .focusEffectDisabled()
            SessionComposer(composer: composer, send: { _ in }, draft: $held)
                .padding(.horizontal, ArgoSpacing.section)
                .padding(.bottom, ArgoSpacing.loose)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        .argoDeckSurface()
        .defaultFocus($parked, true)
    }

    /// The one fixture every composer case renders — a managed Claude Session with a model, idle
    /// enough to take the next thing typed.
    static let composer = SessionComposerProjection.Composer(
        sessionID: "specimen",
        placeholder: "Message Claude Code…",
        facts: "Opus 5",
        standingAllows: [],
        isRunning: false,
    )

    /// The same Session mid-Turn: the field invites a follow-up rather than a message, and what is
    /// typed waits above it instead of going.
    static let running = SessionComposerProjection.Composer(
        sessionID: composer.sessionID,
        placeholder: SessionComposerProjection.queuePlaceholder,
        facts: composer.facts,
        standingAllows: [],
        isRunning: true,
    )

    /// The same vessel on a Session that has stopped asking about two tools (#572). Its own state
    /// because the tray is only ever seen at rest, the turn AFTER the grant.
    static let standing = SessionComposerProjection.Composer(
        sessionID: composer.sessionID,
        placeholder: composer.placeholder,
        facts: composer.facts,
        standingAllows: ["Bash", "Read"].map(StandingAllow.init(toolName:)),
        isRunning: false,
    )

    /// The typing state's draft: multi-line, because the growth past one line IS the state.
    static let typing = ComposerDraft(
        text: """
        The roster sorts on last activity, but the caption still says "by name".
        Fix the caption, not the sort: the sort is right.

        While you are in there, check whether SessionRow reads the same field twice.
        """,
    )

    /// Past the six-line ceiling, where the field stops growing and scrolls inside itself. The
    /// state exists to prove the feed above is never squeezed out by a long message.
    static let ceiling = ComposerDraft(
        text: typing.text + """


        And if it does, pull it up into the projection rather than into a computed property on \
        the row — the row should be handed a value, never derive one.

        Then run the contract suite and tell me what moved.
        """,
    )

    /// The refused state's draft: the message still where it was typed, the reason above it —
    /// in the port's own words, so the render and the seam cannot drift apart.
    static let refused = ComposerDraft(
        text: "Carry on with the plan.",
        refusal: SessionDriveError.notDrivable.detail,
    )

    /// A follow-up waiting on the Turn in flight, drawn above an empty field.
    static let queued = ComposerDraft(
        queued: [QueuedTurn(text: "And when that is green, open the PR against main.")],
    )

    /// A draft that survived leaving the Session and coming back. Measured back from whenever the
    /// case is rendered rather than stamped once, for the reason the roster's ages are: a fixed
    /// millisecond would age into `3y ago` in the render it is meant to prove.
    static var kept: ComposerDraft {
        let anHourAgo = WallClock.nowMs() - 51 * 60 * 1000
        return ComposerDraft(
            text: "Before the PR: check that the scroll anchor survives a compaction. I think it",
            editedAtMs: anHourAgo,
        )
    }
}

#Preview("Composer specimen — typing") {
    ComposerSpecimen(draft: ComposerSpecimen.typing)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — at the six-line ceiling") {
    ComposerSpecimen(draft: ComposerSpecimen.ceiling)
        .frame(width: 900, height: 420)
        .argoAppearance()
}

#Preview("Composer specimen — a refused send") {
    ComposerSpecimen(draft: ComposerSpecimen.refused)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — a draft that was kept") {
    ComposerSpecimen(draft: ComposerSpecimen.kept)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — a queued follow-up") {
    ComposerSpecimen(composer: ComposerSpecimen.running, draft: ComposerSpecimen.queued)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — standing allows") {
    ComposerSpecimen(composer: ComposerSpecimen.standing)
        .frame(width: 900, height: 320)
        .argoAppearance()
}
