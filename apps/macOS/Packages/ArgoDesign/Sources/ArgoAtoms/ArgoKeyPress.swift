import SwiftUI

public extension View {
    /// Space and Return, answered exactly as the click is.
    ///
    /// The pair is here rather than at each control because a focusable that takes its own key
    /// events (`.focusable()` on a `Button`) stops answering them itself, so every such control
    /// has to hand them back — and a control that answered only one of the two would be a keyboard
    /// that works for some readers and not others.
    func argoPressedByKey(_ press: @escaping () -> Void) -> some View {
        onKeyPress(.space) {
            press()
            return .handled
        }
        .onKeyPress(.return) {
            press()
            return .handled
        }
    }
}
