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
    /// Whether the seam is under the reader's hand, reported for as long as it is.
    ///
    /// A seam knows this and nothing else does. What it costs to publish is one `Bool`; what it
    /// buys is every zone downstream being able to tell a layout the READER moved from one it
    /// moved itself — see `FeedPlace` for the surface that needs the difference.
    var isDragging: (Bool) -> Void = { _ in }

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
                if startedAt == nil {
                    isDragging(true)
                }
                startedAt = start
                let travelled = growsRightward ? move.translation.width : -move.translation.width
                // Seated rather than written through: the pointer answers in fractions of a point,
                // and the zone this sizes is a column of prose. See `ArgoLayout.seated`.
                width = ArgoLayout.seated(start + travelled, in: limits)
            }
            .onEnded { _ in
                startedAt = nil
                isDragging(false)
            }
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

extension EnvironmentValues {
    /// Whether a deck seam is being dragged right now.
    ///
    /// In the environment rather than threaded down, because the zone that needs it is three views
    /// below the seam and none of the views in between has any business carrying it.
    @Entry var deckIsResizing: Bool = false
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
