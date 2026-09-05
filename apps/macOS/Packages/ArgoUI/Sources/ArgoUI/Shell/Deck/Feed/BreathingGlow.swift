import ArgoDesign
import Foundation
import SwiftUI

/// A mark that BREATHES on the pass it is under: one rise and fall of its strength per pass of
/// `ArgoMotion.working`. The roster's state dot and the `PlanBar` segment beneath it are two
/// readings of one live Turn, and this is the one place either of them is drawn moving (#1403).
///
/// It sits beside `FeedIonLoop` rather than beside its callers for that file's own reason: the
/// breath belongs to `ArgoMotion.working`, not to the room that first drew it.
struct BreathingMark<Content: View>: View {
    /// The strength to park at with movement off, as a share of the peak.
    ///
    /// Each surface answers this for itself, because Reduce Motion has to cost the reader the
    /// MOVEMENT and not the state. A halo is light AROUND a mark, so it parks at the breath's own
    /// floor and the mark underneath keeps its ink. A segment IS the mark: parked at the floor it
    /// would draw dimmer than the completed steps beside it, saying the step nobody can act on was
    /// the brighter one. It parks at full.
    let parkedAt: Double
    /// The top of the breath, off the rung the wait's age has cooled the pass to. The dot's halo is
    /// light and peaks at the rung's own glow; ink is already drawn at the strength the design gave
    /// it, so it peaks at full and cools only in PERIOD.
    var peak: (ArgoWaitAge) -> Double = { _ in 1 }
    @ViewBuilder let content: () -> Content

    var body: some View {
        FeedIonLoop { phase, aged in
            content()
                .modifier(BreathingGlow(
                    phase: phase ?? 0,
                    peak: peak(aged),
                    // The loop says `nil` for "nothing is moving" — Reduce Motion, or no Turn to
                    // report. One place turns that into a strength, so no caller can answer it
                    // twice and disagree with itself.
                    parked: phase == nil ? parkedAt : nil,
                ))
        }
    }
}

/// One breath, as a function of `FeedIonLoop`'s phase. Argo has ONE breathing curve and one floor:
/// a second curve for the second reading of a Turn would say the two were reporting different
/// things.
///
/// `Animatable` is the whole point. SwiftUI interpolates a modifier's `animatableData` and rebuilds
/// its body at each step, so the curve below is evaluated ALONG the pass. An opacity computed in a
/// view body would instead be interpolated between its two end values, and a curve that starts and
/// ends in the same place would not animate at all.
struct BreathingGlow: ViewModifier, Animatable {
    /// The share of `peak` the bottom of the breath holds. The light rises and falls; it does not
    /// switch. A breath that reached zero would read as a blink, which says a Turn started and
    /// stopped rather than one that is running.
    ///
    /// One number for every breathing surface: two floors would let the two marks on one row reach
    /// their bottoms at different depths on the same Turn.
    static let resting: Double = 0.4

    var phase: Double
    /// The surface's own full strength, at the top of the breath.
    let peak: Double
    /// The share of `peak` to park at, or `nil` while the breath is travelling. `BreathingMark` is
    /// the only thing that decides this.
    let parked: Double?

    /// `nonisolated` because `ViewModifier` is main-actor isolated and `Animatable` is not:
    /// SwiftUI interpolates this off the main actor, and the conformance does not compile without
    /// saying so.
    nonisolated var animatableData: Double {
        get { phase }
        set { phase = newValue }
    }

    func body(content: Content) -> some View {
        content.opacity(opacity)
    }

    /// What the reader actually sees: the curve, scaled to the surface's own strength.
    var opacity: Double {
        peak * strength
    }

    /// A cosine rise and fall over the pass: `resting` at both ends, full in the middle. Equal ends
    /// are what makes the loop's re-entry invisible — the phase snaps back to 0 between passes, and
    /// a curve that did not close would snap the light with it.
    var strength: Double {
        if let parked {
            return parked
        }
        let rise = (1 - cos(2 * .pi * phase)) / 2
        return Self.resting + (1 - Self.resting) * rise
    }
}
