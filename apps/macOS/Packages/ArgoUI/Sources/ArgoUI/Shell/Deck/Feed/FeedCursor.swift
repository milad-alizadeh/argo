import SwiftUI

/// The shape a row's keyboard cursor goes around, when that is not the row.
///
/// A prompt is a bubble on the trailing edge, and a ring around its ROW is the full column, offset
/// well to the left of the bubble — the wrong box #533 was filed about. Every other row fills the
/// measure, so its own bounds are the honest ring and it claims nothing.
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

    /// Around the claimed shape, or the row's own bounds when nothing claimed one.
    private func ring(_ shape: FeedCursorShape?, in proxy: GeometryProxy) -> some View {
        let bounds = shape.map { proxy[$0.bounds] } ?? CGRect(origin: .zero, size: proxy.size)
        return ArgoFocusRing(RoundedRectangle(cornerRadius: shape?.radius ?? ArgoRadius.control))
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

    /// The row's keyboard cursor, on while the reading is what the reader has the keyboard in —
    /// see `FeedTableCoordinator.cursorRow`.
    func argoFeedCursor(_ isOn: Bool) -> some View {
        modifier(FeedCursor(isOn: isOn))
    }
}
