import ArgoDesign
import AtlasLayout
import SwiftUI

/// The two clocks the cords are drawn on, as ONE value (#1425): how present the whole-map layer is,
/// and where the lap of light has got to.
///
/// A pair rather than two views, because they are one picture — a reader who turns the ties off
/// mid-lap is owed one set of cords doing both, not a fade that cancels a travel.
struct AtlasCordClock: Equatable {
    /// The whole-map layer's presence, 0 to 1. See `AtlasTieCords.layer`.
    var layer: Double
    /// Where the lap has got to, 0 to 1. See `AtlasTieCords.lap`.
    var lap: Double
}

/// The cords on one frame, at the point their clocks have reached (#1160, #1425).
///
/// Its own view because `clock` is what `Animatable` interpolates, and a `@State` is storage rather
/// than a property SwiftUI can tween: the state lives in `AtlasTieCords` and the tween lives here.
/// The cords themselves are CHOSEN above and handed down, so the sort over 18,402 couplings stays
/// off the path that re-runs once a frame.
struct AtlasDrawnCords: View {
    @Environment(\.argo) private var argo

    /// Every cord on this frame, in the order they are stroked.
    let cords: [AtlasDrawnCord]
    /// The frame the cords were projected into, which is the frame they are drawn at.
    let viewport: CGSize
    /// Whether light is passing along them. With it off the frame is the cords alone, which is what
    /// Reduce Motion and a pointer somewhere else both resolve to.
    let travelling: Bool

    var clock: AtlasCordClock

    var body: some View {
        Canvas { context, _ in
            for (place, drawn) in cords.enumerated() {
                let presence = drawn.weight.presence(clock.layer)
                context.stroke(
                    Self.path(of: drawn.cord),
                    with: .color(
                        argo.color.atlas.marks.cord.color.opacity(drawn.alpha * presence),
                    ),
                    style: StrokeStyle(lineWidth: drawn.width, lineCap: .round),
                )
                guard travelling else { continue }
                // The cord's OWN colour, brighter: the contract names one mark for a tie, and a
                // second hue for the light along it would be a colour decided at a call site.
                AtlasTravel(along: drawn, at: place, into: clock.lap)
                    .draw(in: &context, as: argo.color.atlas.marks.cord, at: presence)
            }
        }
        // The map is under it, and a click on a cord is a click on the map: taking the mouse here
        // would put a hole in the city along every tie the reader asked to see.
        .allowsHitTesting(false)
        .frame(width: viewport.width, height: viewport.height)
    }

    private static func path(of cord: AtlasCord) -> Path {
        Path { path in
            path.move(to: cord.start)
            path.addQuadCurve(to: cord.end, control: cord.control)
        }
    }
}

extension AtlasDrawnCords: @MainActor Animatable {
    /// The two scalars the cords' motion is drawn from, and nothing else. SwiftUI interpolates them
    /// over whatever animation the call site's `withAnimation` set, and every step lands back in
    /// the `Canvas` above — which is what makes the layer a fade rather than a cut and the light a
    /// travel rather than a jump. Declared in an extension for `AtlasView`'s reason: a view's
    /// conformance to `Animatable` crosses into main-actor isolated code.
    var animatableData: AnimatablePair<Double, Double> {
        get { AnimatablePair(clock.layer, clock.lap) }
        set { clock = AtlasCordClock(layer: newValue.first, lap: newValue.second) }
    }
}
