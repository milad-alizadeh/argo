import SwiftUI

/// What is waiting on the running Turn, oldest at the top — the order they will go in, drawn as
/// the order they are read in (design decision 4).
struct QueuedTurnStack: View {
    let turns: [QueuedTurn]
    /// Take one back, by id. The whole point of drawing a queued turn is that it is still
    /// recallable.
    let cancel: (UUID) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
            ForEach(turns) { turn in
                QueuedTurnChip(turn: turn) { cancel(turn.id) }
            }
        }
        .padding(.bottom, ArgoSpacing.snug)
    }
}

#Preview("Queued turns — one waiting") {
    QueuedTurnStack(turns: [QueuedTurn(text: "Run the suite once more.")], cancel: { _ in })
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
        cancel: { _ in },
    )
    .padding(ArgoSpacing.section)
    .frame(width: 640)
    .argoDeckSurface()
    .argoAppearance()
}
