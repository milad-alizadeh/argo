import Foundation

/// How the one loop reads as the wait it reports gets older. A rung of the ladder `ArgoMotion
/// .working` cools down, and the reason that role's period is a feeling rather than a cost.
///
/// Past roughly 10s a wait stops being part of the interaction, so a Turn six minutes in must not
/// draw like one three seconds in.
///
/// It cools; it never warms. Claude Code warms its spinner to amber at 10s and Argo must not:
/// `state.attention` means something needs YOU, and a long wait needs nothing. Warming would render
/// a false call for attention, which is what degrade-down exists to prevent.
public struct ArgoWaitAge: Sendable, Equatable {
    /// How long the wait has to have run for this rung to take over.
    public let after: TimeInterval
    /// The loop's period here. A PERIOD and not a wait, which is why `ArgoMotion.durationCeiling`
    /// does not reach it.
    public let period: TimeInterval
    /// How brightly the ion glows here. The THREAD's glow: that is the surface the design's table
    /// was measured on, and its first rung is `ArgoElevation.bloom.opacity` exactly.
    public let glow: Double

    /// The same fall-off as a share of the first rung, for a surface whose full strength is not the
    /// thread's. The row's wash paints type rather than casting light, so it cools by this
    /// PROPORTION — taking the thread's own numbers there would dim a three-second call.
    public var cooling: Double {
        glow / ArgoWaitAge.all[0].glow
    }

    /// The loop at this rung: `ArgoMotion.working`'s own curve and Reduce Motion answer, over this
    /// period. The role still answers Reduce Motion, because an aged wait has no still of its own —
    /// the stills do not vary by age.
    public var motion: ArgoMotion {
        let role = ArgoMotion.working
        return ArgoMotion(
            duration: period,
            curve: role.curve,
            reducedDuration: role.reducedDuration,
            repeats: role.repeats,
        )
    }
}

public extension ArgoWaitAge {
    /// The ladder, youngest first. The first rung is what `ArgoMotion.working` and
    /// `ArgoElevation.bloom` already say, so a short wait draws exactly as it did and every other
    /// rung is a step down from a state somebody approved.
    static let all: [ArgoWaitAge] = [
        ArgoWaitAge(after: 0, period: 1.9, glow: 0.60),
        ArgoWaitAge(after: 10, period: 2.8, glow: 0.49),
        ArgoWaitAge(after: 60, period: 3.8, glow: 0.40),
        ArgoWaitAge(after: 300, period: 4.9, glow: 0.30),
    ]

    /// The rung a wait of this age reads at. The threshold belongs to the COLDER rung, and an age
    /// below the ladder reads as the first: a clock that has not started must not draw a wait
    /// colder than a fresh one.
    static func rung(at age: TimeInterval) -> ArgoWaitAge {
        all.last { age >= $0.after } ?? all[0]
    }

    /// Where a wait ends up and stays. The ladder has a floor on purpose: a pass slow enough to
    /// stop reading as travel would say the Turn had stopped, which is the one thing it must not
    /// say.
    static var coldest: ArgoWaitAge {
        rung(at: .infinity)
    }
}
