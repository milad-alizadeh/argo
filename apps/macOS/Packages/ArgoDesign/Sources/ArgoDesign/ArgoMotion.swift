import SwiftUI

/// A motion role: what it does at full strength, and what it does instead under Reduce Motion.
/// The Reduce Motion answer belongs to the role, never to the call site.
///
/// Every role is brief and event-driven, with two exceptions. `working` loops, because a live
/// operational signal may repeat for as long as its operation lasts (D12) — the Turn is the
/// operation, and the Turn ending is the event that stops it. `travel` loops for the same reason
/// one rung down: a cord reports that a dependency is live, and nothing ends it but the map
/// closing. Nothing else in the contract repeats.
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
    /// A role the surface runs over many boxes at once, and the gap between one box starting and
    /// the next. The two numbers are only meaningful together, which is why they travel together.
    struct Staggered: Sendable {
        public let name: String
        public let motion: ArgoMotion
        /// The gap between the FIRST box starting and the LAST one starting. The reader waits this
        /// plus one whole `motion`, and it is that sum `durationCeiling` bounds.
        public let stagger: TimeInterval

        /// What the reader waits for the whole role to finish, first box to last.
        public var wait: TimeInterval {
            motion.duration + stagger
        }
    }

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
        duration: 1.2,
        curve: .linear,
        reducedDuration: nil,
        repeats: true,
    )

    // MARK: - The Atlas

    // The map's roles, ported from the prototype's own numbers (`docs/designs/cockpit-atlas.html`;
    // the line numbers are in #1420) and COMPRESSED to fit `durationCeiling`. The prototype ran
    // the reshuffle over 1080ms end to end, the rise over 1020 and the flip over 980; the contract
    // stays sealed and the map reads faster than the prototype did.
    //
    // ONE factor, 0.5/1.08, applied to every number rather than a cap applied to the four that
    // broke the ceiling. Capping only those would have flattened the flip onto the snap and sunk
    // the rise below the naming, and the map says with SPEED which kind of change it is making —
    // a reshuffle is slower than a snap because it moves more of the reader's picture. The order
    // is the thing being preserved, and `MotionContractTests` holds it against the prototype's
    // milliseconds directly.
    //
    // Every one of them cuts under Reduce Motion rather than fading, which is what the
    // prototype's `CALM` flag does at every call site — including the naming, whose fade exists
    // only to stop a name popping and which `CALM` collapses to a cut at line 2695. None of them
    // is a status word whose change has to be noticed, so there is nothing left to fade.

    /// The plan standing up into the city, one box. Eased rather than sprung, though the prototype
    /// overshoots: `Curve.spring` spends `duration` as SwiftUI's `response`, which is not when the
    /// box stops moving, so a sprung role would be one the ceiling cannot bound. A ceiling that
    /// cannot measure its own role is worth more here than the overshoot.
    static let rise = ArgoMotion(duration: 0.18, curve: .easeOut, reducedDuration: nil)

    /// The gap between the FIRST box rising and the LAST one starting. A SPAN and not a duration:
    /// one `rise` still runs at the end of it, so the two together are what the reader waits, and
    /// that sum is what `durationCeiling` bounds. See `staggered`.
    static let riseStagger: TimeInterval = 0.29

    /// The city lying down into the treemap, and standing back up. The longest single move on the
    /// map, because it is the only one that changes what the reader is looking at rather than
    /// where.
    static let lieDown = ArgoMotion(duration: 0.45, curve: .easeInOut, reducedDuration: nil)

    /// The camera flying to a box the reader picked. Eased OUT alone: the flight starts the instant
    /// the click lands, so easing into it would read as the click being missed.
    static let snap = ArgoMotion(duration: 0.23, curve: .easeOut, reducedDuration: nil)

    /// One domain's boxes moving to their places in a new arrangement.
    static let reshuffle = ArgoMotion(duration: 0.36, curve: .easeInOut, reducedDuration: nil)

    /// The gap between the FIRST domain starting to move and the LAST one starting, on the same
    /// terms as `riseStagger`. The prototype spreads it over each domain's RANK as a fraction of
    /// the whole, so it is a span however many domains there turn out to be.
    static let reshuffleStagger: TimeInterval = 0.14

    /// A layer of the map arriving or leaving — a filter applied, a search typed. A cut at this
    /// size reads as the map being replaced rather than as it answering.
    static let layerFade = ArgoMotion(duration: 0.19, curve: .easeInOut, reducedDuration: nil)

    /// A box's name arriving or leaving. The shortest role on the map: a name that takes as long as
    /// a move pops after the box it belongs to has already settled.
    static let naming = ArgoMotion(duration: 0.10, curve: .easeOut, reducedDuration: nil)

    /// The rim closing around the box the reader pointed at.
    static let pin = ArgoMotion(duration: 0.19, curve: .easeInOut, reducedDuration: nil)

    /// The second loop: one lap of a travel cord, the map's report that a dependency is live. A
    /// PERIOD rather than a wait, so neither `durationCeiling` nor the compression above reaches
    /// it, and far slower than `working` because a cord is read out of the corner of the eye while
    /// the reader is doing something else. `nil` under Reduce Motion for the reason every loop has:
    /// it stops, and the still cords still say what depends on what.
    static let travel = ArgoMotion(
        duration: 5.2,
        curve: .linear,
        reducedDuration: nil,
        repeats: true,
    )

    /// The map's roles as one list. The Atlas is a surface of its own, so a test or a specimen that
    /// has something to say about the map says it over this rather than over eight names it
    /// restates — a ninth role added here is judged by everything that reads it.
    static let atlas: [(name: String, motion: ArgoMotion)] = [
        ("rise", rise), ("lieDown", lieDown), ("snap", snap), ("reshuffle", reshuffle),
        ("layerFade", layerFade), ("naming", naming), ("pin", pin), ("travel", travel),
    ]

    static let all: [(name: String, motion: ArgoMotion)] = [
        ("stateChange", stateChange), ("selection", selection), ("reveal", reveal),
        ("bloom", bloom), ("resettle", resettle), ("working", working),
    ] + atlas

    /// A role and the span it is staggered over, for the two the map spreads across many boxes.
    /// The pair is what the reader waits, so it is the pair the ceiling is asserted against.
    static let staggered: [Staggered] = [
        Staggered(name: "rise", motion: rise, stagger: riseStagger),
        Staggered(name: "reshuffle", motion: reshuffle, stagger: reshuffleStagger),
    ]

    /// Roles nothing draws yet, and what each is waiting on. A role is kept only while the decision
    /// behind it still has a surface coming — `latch` left with the Dock it timed (#536 closed on
    /// the floating composer). A key naming no role fails the contract suite, and the specimen
    /// draws a kept role as unjudged.
    static let unwired: [String: String] = [
        // The Atlas roles are decided (#1420) and the map does not read them yet: the motion is
        // ported per surface, and each of these is waiting on the surface that spends it.
        "rise": "the plan-to-city transition",
        "snap": "the camera flight to a picked box",
        "reshuffle": "the domain re-arrangement",
        "layerFade": "the map's filter and search repaints",
        "naming": "the plate name strip",
        "pin": "the pointer's rim mark",
        "travel": "the dependency cords",
    ]

    /// Spent by `MotionContractTests`, never by a surface: a ceiling a call site reached for
    /// would be a duration, which is the thing it forbids.
    ///
    /// No NON-REPEATING role may run longer than this. Past it a transition stops reading as
    /// feedback and starts reading as latency. A repeating role is outside the cap because the
    /// ceiling measures how long a reader waits for a change to finish, and a loop never finishes:
    /// its `duration` is a period the reader watches, not a wait.
    static let durationCeiling: TimeInterval = 0.5

    /// How long Argo may take to draw a Session before the deck owes the reader a word.
    ///
    /// `durationCeiling` spent as a DELAY rather than as a duration, which is the one reading of it
    /// a surface is allowed: past the point at which a change stops reading as feedback and starts
    /// reading as latency, the surface is no longer covering a transition — it is holding a reader
    /// in front of a blank, and the honest thing is to say so (`FeedVacancy.unread`).
    ///
    /// Derived rather than written down, so the two cannot drift into two answers to one question.
    /// A word held back for less than this would flash on every click, which is worse than no word
    /// at all; a word held back for longer would leave the blank unexplained past the moment the
    /// reader started wondering.
    static let unreadDelay: TimeInterval = durationCeiling

    /// The gap a loop driven one pass at a time leaves between two passes. SwiftUI folds every
    /// change in a tick into the last value, so putting the ion back at its start has to be a tick
    /// of its own or the next pass animates from nowhere. One frame, and spent entirely off the
    /// surface — both ends of the travel already clear it.
    static let passReentry: TimeInterval = 1.0 / 60
}

public extension EnvironmentValues {
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
