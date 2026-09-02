import ArgoDesign
import SwiftUI

public extension View {
    /// Animates `value` with a contract role, resolving Reduce Motion from the environment.
    func argoAnimation(_ motion: ArgoMotion, value: some Equatable) -> some View {
        modifier(ArgoAnimationModifier(motion: motion, value: value))
    }
}

private struct ArgoAnimationModifier<Value: Equatable>: ViewModifier {
    @Environment(\.argoReduceMotion) private var reduceMotion

    let motion: ArgoMotion
    let value: Value

    func body(content: Content) -> some View {
        content.animation(motion.resolved(reduceMotion: reduceMotion), value: value)
    }
}
