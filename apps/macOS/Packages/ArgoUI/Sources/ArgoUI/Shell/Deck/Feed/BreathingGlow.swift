import Foundation
import SwiftUI

/// One breath, as a function of `FeedIonLoop`'s phase. Argo has ONE breathing curve: the roster's
/// state dot and the `PlanBar` segment under it are two readings of the same live Turn, and a
/// second curve for the second reading would say they were reporting different things (#1403).
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
    /// The strength at the top of the breath — the surface's own full strength. The dot's halo is
    /// light, so its peak is the rung's glow; an ink mark is already drawn at the strength the
    /// design gave it, so its peak is 1.
    let peak: Double
    /// The share of `peak` to park at with movement off, or `nil` while the breath is travelling.
    ///
    /// Each surface answers this for itself, because Reduce Motion has to cost the reader the
    /// MOVEMENT and not the state. A halo is light around a mark, so it parks at the breath's own
    /// floor and the mark keeps its ink. A segment IS the mark, and one parked at the floor would
    /// draw dimmer than the completed steps beside it — saying the step nobody can act on is the
    /// brighter one. It parks at full.
    let parked: Double?

    /// `nonisolated` because `ViewModifier` is main-actor isolated and `Animatable` is not:
    /// SwiftUI interpolates this off the main actor, and the conformance does not compile without
    /// saying so.
    nonisolated var animatableData: Double {
        get { phase }
        set { phase = newValue }
    }

    func body(content: Content) -> some View {
        content.opacity(peak * strength)
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
