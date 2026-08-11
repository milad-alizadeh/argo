import ArgoEngine
import SwiftUI

/// The composer's own states — typing, and a refused send — at the width the feed column gives
/// the vessel. The composed state (glass over a real reading, the fade under it) is the deck's
/// case; what these add is what only the vessel itself can show.
struct ComposerSpecimen: View {
    var composer = ComposerSpecimen.composer
    var draft = ComposerDraft()

    /// Where the window's opening focus is parked. Left to itself the field is the first key
    /// view, and macOS select-alls a focused field's text — which renders a draft as a selection,
    /// a state this case is not about.
    @FocusState private var parked: Bool

    var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            Color.clear
                .frame(height: ArgoStroke.border)
                .focusable()
                .focused($parked)
                .focusEffectDisabled()
            SessionComposer(composer: composer, send: { _ in }, draft: draft)
                .padding(.horizontal, ArgoSpacing.section)
                .padding(.bottom, ArgoSpacing.loose)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        .argoDeckSurface()
        .defaultFocus($parked, true)
    }

    /// The one fixture every composer case renders — a managed Claude Session with a model.
    static let composer = SessionComposerProjection.Composer(
        sessionID: "specimen",
        placeholder: "Message Claude Code…",
        facts: "Opus 5",
        standingAllows: [],
    )

    /// The same vessel on a Session that has stopped asking about two tools (#572). A state of its
    /// own because the tray is only ever seen at rest — the moment it matters is the turn AFTER
    /// the grant, when the prompt that made it is long gone.
    static let standing = SessionComposerProjection.Composer(
        sessionID: composer.sessionID,
        placeholder: composer.placeholder,
        facts: composer.facts,
        standingAllows: ["Bash", "Read"].map(StandingAllow.init(toolName:)),
    )

    /// The typing state's draft: multi-line, because the growth past one line IS the state.
    static let typing = ComposerDraft(
        text: """
        The roster sorts on last activity, but the caption still says "by name".
        Fix the caption, not the sort: the sort is right.

        While you are in there, check whether SessionRow reads the same field twice.
        """,
    )

    /// The refused state's draft: the message still where it was typed, the reason above it —
    /// in the port's own words, so the render and the seam cannot drift apart.
    static let refused = ComposerDraft(
        text: "Carry on with the plan.",
        refusal: SessionDriveError.notDrivable.detail,
    )
}

#Preview("Composer specimen — typing") {
    ComposerSpecimen(draft: ComposerSpecimen.typing)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — a refused send") {
    ComposerSpecimen(draft: ComposerSpecimen.refused)
        .frame(width: 900, height: 320)
        .argoAppearance()
}

#Preview("Composer specimen — standing allows") {
    ComposerSpecimen(composer: ComposerSpecimen.standing)
        .frame(width: 900, height: 320)
        .argoAppearance()
}
