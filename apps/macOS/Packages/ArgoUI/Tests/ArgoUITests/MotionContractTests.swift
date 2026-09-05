import ArgoDesign
import Foundation
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
        for role in ArgoMotion.atlas {
            #expect(role.motion.reducedDuration == nil, "\(role.name) fades instead of cutting")
        }
    }

    /// The map is one catalogue, so a role that reached the Atlas without reaching the contract's
    /// own list would ship unjudged by every claim above and undrawn by the specimen.
    @Test
    func `every map role is a role the contract enumerates`() {
        let all = Set(ArgoMotion.all.map(\.name))
        for role in ArgoMotion.atlas {
            #expect(all.contains(role.name), "\(role.name) is missing from ArgoMotion.all")
        }
    }

    /// The prototype's own milliseconds (`docs/designs/cockpit-atlas.html`; the line numbers are in
    /// #1420). Held here rather than in the contract, because the contract states what the cockpit
    /// DOES and these are only what it was compressed from.
    static let prototypeMilliseconds = [
        "rise": 400.0, "lieDown": 980.0, "snap": 500.0, "reshuffle": 780.0,
        "layerFade": 420.0, "naming": 220.0, "pin": 420.0, "travel": 5200.0,
    ]

    /// What the compression was FOR. Fitting the ceiling by capping only the four roles that broke
    /// it would have left every number under it untouched and flattened the map's order — the flip
    /// onto the snap, the rise under the naming. One factor over all of them keeps the order, and
    /// the order is how a reader tells a reshuffle from a snap without being told which it was.
    @Test
    func `compressing the map to the ceiling reordered none of its roles`() {
        for first in ArgoMotion.atlas {
            for second in ArgoMotion.atlas {
                guard let was = Self.prototypeMilliseconds[first.name],
                      let then = Self.prototypeMilliseconds[second.name]
                else {
                    Issue.record("\(first.name)/\(second.name) has no prototype number")
                    continue
                }
                #expect(
                    ordering(first.motion.duration, second.motion.duration) == ordering(was, then),
                    "\(first.name) and \(second.name) swapped places under the compression",
                )
            }
        }
    }

    /// Which of two numbers is the larger, as a value two orderings can be compared by.
    private func ordering(_ first: Double, _ second: Double) -> ComparisonResult {
        if first < second {
            return .orderedAscending
        }
        return first > second ? .orderedDescending : .orderedSame
    }

    /// The flip is the first of the map's roles a surface actually spends (#1422): `AtlasSidebar`
    /// wraps the city/treemap switch in it, where it used to reach for `resettle`. The specimen
    /// draws an unwired role as unjudged, so leaving the note behind would hide a role that ships.
    @Test
    func `the city lying down is a role a surface spends`() {
        #expect(ArgoMotion.unwired["lieDown"] == nil)
        // Eased at BOTH ends, which is the whole reason it is not `resettle`: the move starts from
        // a picture that was standing still, and an abrupt start reads as the map being dropped.
        guard case .easeInOut = ArgoMotion.lieDown.curve else {
            Issue.record("the flip is not eased at both ends")
            return
        }
        // And the longest single move on the map, because it changes what the reader is looking at
        // rather than where.
        let single = ArgoMotion.atlas.filter { !$0.motion.repeats }
        #expect(single.allSatisfy { $0.motion.duration <= ArgoMotion.lieDown.duration })
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
