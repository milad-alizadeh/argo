import SwiftUI

/// A motion role: what it does at full strength, and what it does instead under Reduce Motion.
/// The Reduce Motion answer belongs to the role, never to the call site.
///
/// Every role is brief and event-driven, with exactly one exception. `working` loops, because a
/// live operational signal may repeat for as long as its operation lasts (D12) — the Turn is the
/// operation, and the Turn ending is the event that stops it. Nothing else in the contract repeats.
public struct ArgoMotion: Sendable {
    public enum Curve: Sendable {
        case easeOut
        case easeInOut
        /// A pass at constant speed. Only a loop uses it: an eased sweep slows at each end, which
        /// over a repeat reads as a stutter rather than as travel.
        case linear
        /// `response` and `dampingFraction` as SwiftUI spells them.
        case spring(damping: Double)
    }

    public let duration: TimeInterval
    public let curve: Curve
    /// The Reduce Motion variant. `nil` means the change lands instantly — correct when the
    /// role's whole content is movement.
    public let reducedDuration: TimeInterval?
    /// Whether the role runs until something stops it. `duration` is then a PERIOD rather than a
    /// wait, which is why the ceiling below does not reach it.
    public let repeats: Bool

    public init(
        duration: TimeInterval,
        curve: Curve,
        reducedDuration: TimeInterval?,
        repeats: Bool = false,
    ) {
        self.duration = duration
        self.curve = curve
        self.reducedDuration = reducedDuration
        self.repeats = repeats
    }

    public var animation: Animation {
        repeats ? pass.repeatForever(autoreverses: false) : pass
    }

    /// One traversal of the role, before any decision about repeating it.
    private var pass: Animation {
        switch curve {
        case .easeOut: .easeOut(duration: duration)
        case .easeInOut: .easeInOut(duration: duration)
        case .linear: .linear(duration: duration)
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

    /// The same answer as ONE traversal, never repeated. A loop is driven through this rather than
    /// through `resolved` — see `FeedIonLoop`.
    public func resolvedPass(reduceMotion: Bool) -> Animation? {
        reduceMotion ? reducedAnimation : pass
    }

    /// The same role over another period. Only a LOOP has one: a non-repeating role's duration is a
    /// wait `durationCeiling` bounds, and nothing may stretch it.
    public func over(_ period: TimeInterval) -> ArgoMotion {
        ArgoMotion(
            duration: period,
            curve: curve,
            reducedDuration: reducedDuration,
            repeats: repeats,
        )
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

    /// The one loop: a Turn in flight, reported by an ion crossing what it is working on. The
    /// period is what a wait FEELS like rather than what it costs, so it is the value a longer wait
    /// slows down — this is the FIRST rung of `ArgoWaitAge`, not the only one. `nil` under Reduce
    /// Motion because a loop has no shorter answer: it stops, and the surface holds a still that
    /// still reads as live.
    static let working = ArgoMotion(
        duration: 1.9,
        curve: .linear,
        reducedDuration: nil,
        repeats: true,
    )

    static let all: [(name: String, motion: ArgoMotion)] = [
        ("stateChange", stateChange), ("selection", selection), ("reveal", reveal),
        ("bloom", bloom), ("resettle", resettle), ("working", working),
    ]

    /// Roles nothing draws yet, and what each is waiting on. A role is kept only while the decision
    /// behind it still has a surface coming — `latch` left with the Dock it timed (#536 closed on
    /// the floating composer). A key naming no role fails the contract suite, and the specimen
    /// draws a kept role as unjudged.
    static let unwired: [String: String] = [:]

    /// Spent by `RhythmTests`, never by a surface: a ceiling a call site reached for would be a
    /// duration, which is the thing it forbids.
    ///
    /// No NON-REPEATING role may run longer than this. Past it a transition stops reading as
    /// feedback and starts reading as latency. A repeating role is outside the cap because the
    /// ceiling measures how long a reader waits for a change to finish, and a loop never finishes:
    /// its `duration` is a period the reader watches, not a wait.
    static let durationCeiling: TimeInterval = 0.5

    /// The gap a loop driven one pass at a time leaves between two passes. SwiftUI folds every
    /// change in a tick into the last value, so putting the ion back at its start has to be a tick
    /// of its own or the next pass animates from nowhere. One frame, and spent entirely off the
    /// surface — both ends of the travel already clear it.
    static let passReentry: TimeInterval = 1.0 / 60
}

extension EnvironmentValues {
    /// Reduce Motion, forced on for a RENDER. `accessibilityReduceMotion` mirrors a system setting
    /// and cannot be written, so a specimen of a still has no other way onto a screenshot.
    ///
    /// Read BESIDE the real setting and never instead of it — a surface that answered this alone
    /// would ignore a reader who actually turned movement off.
    @Entry var argoStillsMotion: Bool = false

    /// Whether movement is off — the reader's own setting, or a render asking for the still. The
    /// one thing a surface reads, so neither answer can be honoured in one place and missed in
    /// another.
    var argoReduceMotion: Bool {
        accessibilityReduceMotion || argoStillsMotion
    }
}
