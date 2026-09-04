import ArgoDesign
import SwiftUI

/// What is waiting on the running Turn, oldest at the top — the order they will go in, drawn as
/// the order they are read in (design decision 4).
struct QueuedTurnStack: View {
    let turns: [QueuedTurn]
    /// Where each one has got to, asked per turn — `ComposerDraft.standing(of:)` is the answer, and
    /// a closure rather than a dictionary so the draft stays the one place that decides.
    var standing: (QueuedTurn.ID) -> QueuedTurnStanding = { _ in .queued }
    /// What the reader can do to one of them — see `QueuedTurnActs`.
    var acts = QueuedTurnActs()

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            ForEach(turns) { turn in
                QueuedTurnChip(turn: turn, standing: standing(turn.id), acts: acts)
            }
        }
        .padding(.bottom, ArgoSpacing.snug)
    }
}

#Preview("Queued turns — one waiting") {
    QueuedTurnStack(turns: [QueuedTurn(text: "Run the suite once more.")])
        .padding(ArgoSpacing.section)
        .frame(width: 640)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Queued turns — three waiting, in the order they will go") {
    QueuedTurnStack(
        turns: [
            QueuedTurn(text: "Run the suite once more."),
            QueuedTurn(text: "Then open the PR against main."),
            QueuedTurn(text: "And put the ticket number in the title."),
        ],
    )
    .padding(ArgoSpacing.section)
    .frame(width: 640)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Queued turns — the first refused, the rest still waiting") {
    let turns = [
        QueuedTurn(text: "Run the suite once more."),
        QueuedTurn(text: "Then open the PR against main."),
    ]
    return QueuedTurnStack(
        turns: turns,
        standing: { $0 == turns[0].id ? .notSent : .queued },
    )
    .padding(ArgoSpacing.section)
    .frame(width: 640)
    .argoDeckSurface()
    .argoAppearance()
}

#Preview("Queued turns — the second steered past the first") {
    let turns = [
        QueuedTurn(text: "Run the suite once more."),
        QueuedTurn(text: "Then open the PR against main."),
    ]
    return QueuedTurnStack(
        turns: turns,
        standing: { $0 == turns[1].id ? .steering : .queued },
        acts: QueuedTurnActs(canSteer: true),
    )
    .padding(ArgoSpacing.section)
    .frame(width: 640)
    .argoDeckSurface()
    .argoAppearance()
}
