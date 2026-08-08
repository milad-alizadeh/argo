import SwiftUI

/// A seam between two zones that the reader can move.
///
/// It draws the same hairline as a fixed separator — a draggable edge must not announce itself as
/// chrome — and takes its whole hit area from an overlay wider than the line, because a half-point
/// target is a seam only a mouse in a good mood can grab. The cursor is what says it moves.
struct DeckSeam: View {
    /// The zone being measured. One side of the seam is a width; the other is whatever is left.
    @Binding var width: CGFloat
    /// How far the measured zone may be dragged. A zone with no floor can be dragged shut, which
    /// loses a surface with no way back other than guessing where its seam went.
    let limits: ClosedRange<CGFloat>
    /// Whether dragging right GROWS the measured zone — true when the zone is to the left of the
    /// seam, false when it is to the right.
    let growsRightward: Bool

    /// The width the drag started from. Held for the whole gesture so the zone tracks the pointer
    /// instead of accumulating each frame's delta, which drifts.
    @State private var startedAt: CGFloat?

    var body: some View {
        DeckSeparator()
            .overlay {
                Color.clear
                    .frame(width: ArgoLayout.seamGrabWidth)
                    .contentShape(.rect)
                    .gesture(drag)
                    .onHover(perform: cursor)
                    .accessibilityLabel("Resize")
            }
    }

    private var drag: some Gesture {
        DragGesture(minimumDistance: 1)
            .onChanged { move in
                let start = startedAt ?? width
                startedAt = start
                let travelled = growsRightward ? move.translation.width : -move.translation.width
                width = min(max(start + travelled, limits.lowerBound), limits.upperBound)
            }
            .onEnded { _ in startedAt = nil }
    }

    /// Pushed and popped rather than set, so leaving the seam mid-window does not leave the whole
    /// app holding a resize cursor.
    private func cursor(_ isInside: Bool) {
        if isInside {
            NSCursor.resizeLeftRight.push()
        } else {
            NSCursor.pop()
        }
    }
}

#Preview("Deck seam — a rail the reader can widen") {
    @Previewable @State var width: CGFloat = ArgoLayout.agentsRailWidth

    HStack(spacing: ArgoSpacing.flush) {
        DeckSlot(zone: .rail)
            .frame(width: width)
        DeckSeam(width: $width, limits: ArgoLayout.railWidths, growsRightward: true)
        DeckSlot(zone: .minimap)
    }
    .frame(width: 720, height: 260)
    .argoDeckSurface()
    .argoAppearance()
}
