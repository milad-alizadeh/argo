import SwiftUI

/// A motion role: what it does at full strength, and what it does instead under Reduce Motion.
/// The Reduce Motion answer belongs to the role, never to the call site.
///
/// Every role is brief and event-driven; nothing in the contract loops.
public struct ArgoMotion: Sendable {
    public enum Curve: Sendable {
        case easeOut
        case easeInOut
        /// `response` and `dampingFraction` as SwiftUI spells them.
        case spring(damping: Double)
    }

    public let duration: TimeInterval
    public let curve: Curve
    /// The Reduce Motion variant. `nil` means the change lands instantly — correct when the
    /// role's whole content is movement.
    public let reducedDuration: TimeInterval?

    public init(duration: TimeInterval, curve: Curve, reducedDuration: TimeInterval?) {
        self.duration = duration
        self.curve = curve
        self.reducedDuration = reducedDuration
    }

    public var animation: Animation {
        switch curve {
        case .easeOut: .easeOut(duration: duration)
        case .easeInOut: .easeInOut(duration: duration)
        case let .spring(damping): .spring(response: duration, dampingFraction: damping)
        }
    }

    /// Under Reduce Motion a role either fades over its reduced duration or does not animate at
    /// all. Either way it stays interruptible: SwiftUI retargets a running animation on a new
    /// value.
    public var reducedAnimation: Animation? {
        reducedDuration.map { .linear(duration: $0) }
    }

    public func resolved(reduceMotion: Bool) -> Animation? {
        reduceMotion ? reducedAnimation : animation
    }
}

public extension ArgoMotion {
    /// A status word or dot changing. Fades under Reduce Motion — the change still has to
    /// be noticed.
    static let stateChange = ArgoMotion(duration: 0.18, curve: .easeOut, reducedDuration: 0.12)
    /// The selection indicator moving between rows or tabs. Pure movement, so it lands
    /// instantly when movement is off.
    static let selection = ArgoMotion(duration: 0.14, curve: .easeOut, reducedDuration: nil)
    /// A popover, a disclosure, an expanding piece of evidence.
    static let reveal = ArgoMotion(duration: 0.22, curve: .easeOut, reducedDuration: 0.10)
    /// Attention arriving: a brightness bloom, once, then still.
    static let bloom = ArgoMotion(duration: 0.42, curve: .easeInOut, reducedDuration: 0.14)

    /// A list re-settling into a new order once the reader has left it. Slower than `selection`
    /// because it moves rows nobody asked to move. Pure movement, so it lands instantly when
    /// movement is off.
    static let resettle = ArgoMotion(duration: 0.28, curve: .easeOut, reducedDuration: nil)

    static let all: [(name: String, motion: ArgoMotion)] = [
        ("stateChange", stateChange), ("selection", selection), ("reveal", reveal),
        ("bloom", bloom), ("resettle", resettle),
    ]

    /// Roles nothing draws yet, and what each is waiting on. A role is kept only while the decision
    /// behind it still has a surface coming — `latch` left with the Dock it timed (#536 closed on
    /// the floating composer). A key naming no role fails the contract suite, and the specimen
    /// draws a kept role as unjudged.
    static let unwired: [String: String] = [:]

    /// No role may run longer than this. Past it a transition stops reading as feedback and
    /// starts reading as latency.
    static let durationCeiling: TimeInterval = 0.5
}

public extension View {
    /// Animates `value` with a contract role, resolving Reduce Motion from the environment.
    func argoAnimation(_ motion: ArgoMotion, value: some Equatable) -> some View {
        modifier(ArgoAnimationModifier(motion: motion, value: value))
    }
}

private struct ArgoAnimationModifier<Value: Equatable>: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let motion: ArgoMotion
    let value: Value

    func body(content: Content) -> some View {
        content.animation(motion.resolved(reduceMotion: reduceMotion), value: value)
    }
}
