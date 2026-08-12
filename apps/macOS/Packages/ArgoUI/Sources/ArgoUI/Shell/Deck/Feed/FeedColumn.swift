import ArgoEngine
import SwiftUI

/// The feed and the composer floating over it, bounded to their own column rather than run across
/// the deck (C4.1). The deck's bottom edge carries no Dock seam any more — it belongs to the
/// reading, and the vessel floats over it (#403, closed by #536).
struct FeedColumn: View {
    let feed: [FeedRow]
    let showing: PlanShowing
    let selection: FeedRowSelection
    var held: FeedRow.ID?
    var composer: SessionComposerProjection.Composer?
    var send: ComposerSend = { _, _ in }
    var prompt: PermissionPromptProjection.Prompt?
    var decide: (PermissionDecision) -> Void = { _ in }
    var revoke: (String) -> Void = { _ in }
    var stop: () throws -> Void = {}
    var setMode: (SessionMode) throws -> Void = { _ in }
    var draft: Binding<ComposerDraft> = .constant(ComposerDraft())

    var body: some View {
        FeedView(rows: feed, selection: selection, held: held, isUnderComposer: hasVessel)
            // Over the feed rather than in the column's stack: a row in the stack would take
            // height from the reading it is meant to sit above. Bounded to this column so it
            // moves with the feed when a seam does, never over the panel.
            .overlay(alignment: .bottom) { pill }
            .overlay(alignment: .bottom) { vessel }
            // Whatever the two seams leave it; prose inside is held to the measure by the rows.
            .frame(maxWidth: .infinity)
    }

    private var hasVessel: Bool {
        composer != nil || prompt != nil
    }

    /// A Session that never reported a plan gets no pill — not an empty one, and not a note saying
    /// there is none. Lifted clear of the vessel when one floats under it.
    @ViewBuilder private var pill: some View {
        if let plan = showing.plan {
            PlanPill(plan: plan, isRevealed: showing.isRevealed)
                .padding(
                    .bottom,
                    hasVessel ? ArgoComposerVessel.feedClearance : ArgoPlanPill.lift,
                )
        }
    }

    /// The prompt takes the composer's own slot: one vessel, holding whichever question is live.
    @ViewBuilder private var vessel: some View {
        if let prompt {
            PermissionPrompt(prompt: prompt, decide: decide, revoke: revoke)
                .padding(.horizontal, ArgoSpacing.section)
                .padding(.bottom, ArgoSpacing.loose)
        } else if let composer {
            SessionComposer(
                composer: composer,
                send: send,
                revoke: revoke,
                stop: stop,
                setMode: setMode,
                draft: draft,
            )
            .padding(.horizontal, ArgoSpacing.section)
            .padding(.bottom, ArgoSpacing.loose)
        }
    }
}
