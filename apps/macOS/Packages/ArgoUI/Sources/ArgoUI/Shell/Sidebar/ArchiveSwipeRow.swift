import SwiftUI

/// A roster row with an Archive behind it, revealed by dragging the row left.
///
/// Its own view around `SessionRow` rather than a modifier on it, because the row's CONTENT is
/// what `SessionRow` is: every preview and specimen that draws a row draws it at rest, and a
/// gesture layer folded into it would put a state nobody is in on all of those renders.
///
/// Nothing here decides anything. How far is far enough, which row closes when another opens and
/// what a release means all live in `RosterSwipe`; this draws that answer and calls the verb.
struct ArchiveSwipeRow: View {
    @Environment(\.argo) private var argo

    let row: SessionRosterProjection.Row
    @Binding var swipe: RosterSwipe
    /// Archive this Session, or — for a row already behind the foot — put it back. One closure
    /// because it is one gesture; which way it goes is the row's own `isArchived`.
    let archive: () -> Void
    /// Name this Session, or drop the name it has. Passed straight through to the row, which is
    /// where the title somebody double-clicks is drawn.
    var rename: (String?) -> Void = { _ in }

    var body: some View {
        ZStack(alignment: .trailing) {
            control
            SessionRow(row: row, rename: rename)
                // At rest the row keeps the sidebar's own material under it (D3).
                .background(isRevealing ? argo.color.surface.raised : .transparent)
                .offset(x: swipe.offset(of: row.id))
        }
        .argoAnimation(.reveal, value: swipe)
        .gesture(drag)
    }

    /// Drawn only once the row has moved, so a roster at rest carries no chrome for this at all
    /// — which is the whole bargain of putting the verb behind a gesture (#514, story 11).
    @ViewBuilder private var control: some View {
        if isRevealing {
            Button(action: take) {
                ArgoGlyph(symbol, .control)
                    .foregroundStyle(argo.color.text.onAccent)
                    .frame(width: swipe.revealedWidth(of: row.id), alignment: .center)
                    .frame(maxHeight: .infinity)
                    .background(argo.color.interaction.accent)
                    .contentShape(.rect)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(label)
        }
    }

    private var isRevealing: Bool {
        swipe.isRevealing(row.id)
    }

    /// The row goes, and the swipe goes with it. Archiving does not change the chain id, so a
    /// row left open would come back open under the other list — showing the opposite verb.
    private func take() {
        swipe.close()
        archive()
    }

    /// An icon and no label (#514): the roster is a narrow column, and a word behind every row
    /// would be read once and then never again.
    private var symbol: String {
        row.isArchived ? ArgoSymbol.unarchive : ArgoSymbol.archive
    }

    /// What a screen reader hears in place of the mark — and the one place the verb is spelled,
    /// since nothing on screen says it in words.
    private var label: String {
        row.isArchived ? "Put back on the roster" : "Archive Session"
    }

    /// A minimum distance, so the drag never competes with the click that selects the row: under
    /// it the gesture does not begin at all and the List takes the event.
    private var drag: some Gesture {
        DragGesture(minimumDistance: ArgoSpacing.tight)
            .onChanged { swipe.drag(row.id, translation: $0.translation.width) }
            .onEnded { _ in
                guard swipe.release(row.id) == .archive else { return }
                take()
            }
    }
}

#Preview("Roster row — at rest, and one swiped open beside them") {
    SwipedRowSpecimen()
        .frame(height: 340)
        .argoAppearance()
}
