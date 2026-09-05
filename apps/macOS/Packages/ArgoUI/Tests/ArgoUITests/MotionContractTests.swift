import ArgoDesign
import Testing

/// What the cockpit claims about MOTION: how long each role runs, which of them repeat, and what
/// every one of them does when the reader has movement turned off. Kept apart from `RhythmTests`
/// because a duration is bounded by the contract's own ceiling rather than by a surface's measure
/// — no test here reaches for a token to bound a drawn box, which is the join that keeps the
/// rhythm suite whole.
@Suite("Motion — the roles, the ceiling and the still")
struct MotionContractTests {
    /// The ceiling asks how long a reader waits for a transition to finish, and a loop never
    /// finishes — its period is a rhythm, not a wait. So it is the non-repeating roles the ceiling
    /// is about.
    @Test
    func `no motion role outlasts feedback`() {
        for role in ArgoMotion.all where !role.motion.repeats {
            #expect(role.motion.duration <= ArgoMotion.durationCeiling)
        }
    }

    /// Reduce Motion has no shorter answer for a loop, so a repeating role must stop rather than
    /// hurry. A `reducedDuration` on one would repeat forever at a faster period.
    @Test
    func `a repeating role stops under Reduce Motion rather than shortening`() {
        for role in ArgoMotion.all where role.motion.repeats {
            #expect(role.motion.reducedDuration == nil)
            #expect(role.motion.resolved(reduceMotion: true) == nil)
        }
    }

    /// The loops are a bound, not a door. D12 lets a live operational signal repeat for exactly as
    /// long as its operation lasts, and each of these two names one: a Turn in flight, and a
    /// dependency the map is reporting live. A THIRD repeating role is a decision, not a detail.
    @Test
    func `only the two live signals loop`() {
        #expect(ArgoMotion.all.filter(\.motion.repeats).map(\.name) == ["working", "travel"])
    }

    /// A role spread across many boxes is waited out box by box, so the ceiling is about the pair.
    /// Stated on `staggered` rather than on the two roles by name: a third staggered role added to
    /// the contract and not to this list is a wait nothing bounds.
    @Test
    func `a staggered role fits the ceiling with its span, not without it`() {
        for role in ArgoMotion.staggered {
            #expect(
                role.wait <= ArgoMotion.durationCeiling,
                "\(role.name) makes the reader wait past the point a transition reads as latency",
            )
        }
    }

    /// The prototype's `CALM` flag cuts to the settled frame at every one of these call sites, and
    /// none of them is a status word whose change has to be noticed. A fade here would be a call
    /// site's decision re-entering the contract.
    @Test
    func `the map's roles cut under Reduce Motion rather than fading`() {
        let map = ["rise", "lieDown", "snap", "reshuffle", "layerFade", "naming", "pin", "travel"]
        for role in ArgoMotion.all where map.contains(role.name) {
            #expect(role.motion.reducedDuration == nil, "\(role.name) fades instead of cutting")
        }
        #expect(Set(ArgoMotion.all.map(\.name)).isSuperset(of: map))
    }

    @Test
    func `the Reduce Motion variant never takes longer than the full one`() {
        for role in ArgoMotion.all {
            guard let reduced = role.motion.reducedDuration else { continue }
            #expect(reduced <= role.motion.duration)
        }
    }

    @Test
    func `every role resolves under Reduce Motion without a call site deciding`() {
        for role in ArgoMotion.all {
            let full = role.motion.resolved(reduceMotion: false)
            #expect(full != nil)
            // A nil reduced animation is a decision, not a gap: the change lands instantly.
            #expect(role.motion.resolved(reduceMotion: true) == nil || role.motion
                .reducedDuration != nil)
        }
    }
}
