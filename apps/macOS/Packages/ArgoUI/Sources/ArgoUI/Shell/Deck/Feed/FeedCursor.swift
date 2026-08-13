import SwiftUI

/// The shape a row's keyboard cursor goes around, when that is not the row.
///
/// Every row but one fills the measure, so the row's own bounds are the honest ring. A prompt is a
/// bubble on the trailing edge, and a ring around its ROW is the full column — offset well to the
/// left of the bubble, which is the wrong box #533 was filed about. A row drawn narrower than the
/// measure claims its shape here and the cursor follows it.
struct FeedCursorShape: Equatable {
    var bounds: Anchor<CGRect>
    var radius: CGFloat
}

private struct FeedCursorShapeKey: PreferenceKey {
    static let defaultValue: FeedCursorShape? = nil

    /// Last writer wins, and there is only ever one: a row has one drawn shape.
    static func reduce(value: inout FeedCursorShape?, nextValue: () -> FeedCursorShape?) {
        value = nextValue() ?? value
    }
}

/// The cursor itself: the contract's focus ring, laid over the row's real shape.
///
/// It is an overlay and never a border, so a row is exactly as tall focused as not — the table
/// measures rows without it, and a cursor that changed a height would shift the reading under the
/// arrow key that moved it.
private struct FeedCursor: ViewModifier {
    @Environment(\.argo) private var argo

    let isOn: Bool

    /// The row without a cursor takes no overlay at all, rather than an empty one. It is the shape
    /// the ruler measures every row in — see `FeedTableCoordinator.measuredHeight` — so the
    /// preference pass behind the ring is one the reading never pays for while scrolling.
    func body(content: Content) -> some View {
        if isOn {
            content.overlayPreferenceValue(FeedCursorShapeKey.self) { shape in
                GeometryReader { proxy in
                    ring(shape, in: proxy)
                }
            }
        } else {
            content
        }
    }

    /// Around the claimed shape, or the row's own bounds when nothing claimed one. Placed by its
    /// centre rather than offset from a corner: inside a reader the corner an offset starts from
    /// is the reader's, and the ring is being put somewhere the row decided.
    private func ring(_ shape: FeedCursorShape?, in proxy: GeometryProxy) -> some View {
        let bounds = shape.map { proxy[$0.bounds] } ?? CGRect(origin: .zero, size: proxy.size)
        return RoundedRectangle(cornerRadius: shape?.radius ?? ArgoRadius.control)
            .strokeBorder(argo.color.interaction.focusRing, lineWidth: ArgoStroke.focus)
            .frame(width: bounds.width, height: bounds.height)
            .position(x: bounds.midX, y: bounds.midY)
    }
}

extension View {
    /// This is the shape the row's cursor goes around, rather than the row. Applied by a row drawn
    /// narrower than the measure; every other row wants the default and says nothing.
    func argoFeedCursorShape(radius: CGFloat) -> some View {
        anchorPreference(key: FeedCursorShapeKey.self, value: .bounds) {
            FeedCursorShape(bounds: $0, radius: radius)
        }
    }

    /// The row's keyboard cursor, on while the table's focus is here.
    ///
    /// No pointer gate: the feed's focus is `FeedTableCoordinator.focusedRow`, which only an arrow
    /// key and the deck's own hand-back ever write. A click reaches the row's controls and moves
    /// nothing (#533).
    func argoFeedCursor(_ isOn: Bool) -> some View {
        modifier(FeedCursor(isOn: isOn))
    }
}
