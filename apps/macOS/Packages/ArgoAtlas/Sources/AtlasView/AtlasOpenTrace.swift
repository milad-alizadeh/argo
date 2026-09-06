import ArgoDesign
import AtlasLayout
import SwiftUI

/// The open file, marked on the map (#1154), and the mark COMMITTING itself (#1425).
///
/// **Focus never repaints the thing it marks.** The colour on this map IS the measure, so marking
/// a file by recolouring it would destroy the fact the reader opened it to inspect. The whole mark
/// is its own edges: the volume traced, and held for as long as it is open.
///
/// The hover rim in the prototype appears at once and the pin draws itself on, and the difference
/// is the point: a hover is provisional and follows a pointer that moves constantly, while a pin
/// is a thing the reader committed to. This is the pin. `ArgoMotion.pin` is what it is drawn over,
/// and it is HELD after — the mark stays for as long as the file is open, which is the sentence
/// #1154 opens by.
struct AtlasOpenTrace: View {
    @Environment(\.argoReduceMotion) private var reduceMotion

    /// The same projection the surface underneath was drawn with, which is the whole of why the
    /// mark cannot land where the volume is not.
    let projection: AtlasProjection
    /// The file the reader has open, or nothing — in which case nothing is drawn, which is what
    /// makes closing the reading unmark the map.
    let open: String?

    /// How much of the mark has been drawn, 0 to 1. It starts SETTLED so that a mark whose clock
    /// never runs — Reduce Motion, or a still — is the whole mark rather than nothing at all.
    @State private var drawn: Double = 1

    var body: some View {
        AtlasCommittedTrace(projection: projection, open: open, drawn: drawn)
            // Keyed on the FILE and not on the projection: the mark is committed when the reader
            // opens something, and re-running it every time the camera moved would redraw the pin
            // from its far corner on every frame of a rise.
            .task(id: open) { await commit() }
    }

    /// The mark drawn on, edge by edge, and then held. The same shape `AtlasRoomView.stand()` runs
    /// the rise in, for the same reasons — including `@MainActor`, which `.task` alone does not
    /// keep an `async` method on.
    @MainActor private func commit() async {
        // Nothing open is nothing to draw, and Reduce Motion cuts to the settled mark: both are
        // answered before the reset, which would otherwise put an unmarked frame on screen.
        guard open != nil, let pin = ArgoMotion.pin.resolved(reduceMotion: reduceMotion) else {
            drawn = 1
            return
        }
        var cut = Transaction()
        cut.disablesAnimations = true
        withTransaction(cut) { drawn = 0 }
        // A tick between the reset and the draw, for `FeedIonLoop`'s reason: SwiftUI folds every
        // change in one tick into the last value, so a reset in the same tick as the draw leaves
        // nothing to animate and the mark simply appears.
        try? await Task.sleep(for: .seconds(ArgoMotion.passReentry))
        withAnimation(pin) { drawn = 1 }
    }
}

/// The mark itself, at the point its clock has reached.
///
/// SwiftUI over the Metal surface rather than in the shader, for `AtlasPlateNames`' reason turned
/// round — the GPU draws faces, and a hairline along a projected silhouette is the one thing a
/// triangle rasteriser has no cheap answer for. The geometry is `AtlasTrace`, which reads the same
/// camera and the same fit the surface hands the GPU, so the mark cannot land where the volume is
/// not.
///
/// Its own view because `drawn` is what `Animatable` interpolates, and a `@State` is storage rather
/// than a property SwiftUI can tween: the state lives above and the tween lives here.
private struct AtlasCommittedTrace: View {
    @Environment(\.argo) private var argo

    let projection: AtlasProjection
    let open: String?
    var drawn: Double

    var body: some View {
        Canvas { context, _ in
            for stroke in strokes {
                context.stroke(
                    Self.path(of: stroke),
                    with: .color(argo.color.text.primary.color),
                    style: StrokeStyle(lineWidth: ArgoStroke.indicator, lineJoin: .round),
                )
            }
        }
        // The map is under it, and a click on the trace is a click on the file it traces: taking
        // the mouse here would put a hole in the city exactly where the reader is looking.
        .allowsHitTesting(false)
        .frame(width: projection.viewport.width, height: projection.viewport.height)
    }

    /// The mark as far as it has been drawn — the whole of it once the clock has run out, which is
    /// every frame the reader spends reading the file rather than opening it.
    private var strokes: [[CGPoint]] {
        trace?.strokes(drawnTo: drawn) ?? []
    }

    /// The traced tile, seen through the camera the map is drawn with — or nothing where no file
    /// is open, or where the open file is not on the map the reader is looking at. The second is
    /// the case a filter makes: hiding test files takes tiles off the plan, and a mark for one of
    /// them would stand over whatever moved into its place.
    private var trace: AtlasTrace? {
        guard let open, let tile = projection.plan.tiles.first(where: { $0.path == open }) else {
            return nil
        }
        return AtlasTrace(of: risen(tile), through: projection)
    }

    /// The tile at the height it is STANDING at this frame, which is its measured height once the
    /// rise has settled and a share of it while the city is still coming up (#1421). Solved off
    /// the same projection the surface underneath was handed, which is why the mark cannot be
    /// drawn at a height the box is not standing at.
    private func risen(_ tile: AtlasTile) -> AtlasTile {
        AtlasTile(
            path: tile.path,
            rect: tile.rect,
            band: tile.band,
            height: AtlasRise(projection).height(of: tile, about: projection.camera.centre),
        )
    }

    private static func path(of stroke: [CGPoint]) -> Path {
        Path { path in
            guard let first = stroke.first else { return }
            path.move(to: first)
            for point in stroke.dropFirst() {
                path.addLine(to: point)
            }
        }
    }
}

extension AtlasCommittedTrace: @MainActor Animatable {
    /// The one scalar the mark is drawn from. SwiftUI interpolates it between 0 and 1 over the pin
    /// role, and every step lands back in `strokes` above — so the pin is a line travelling round
    /// the box rather than a cut between two shapes. Declared in an extension for `AtlasView`'s
    /// reason: a view's conformance to `Animatable` crosses into main-actor isolated code.
    var animatableData: Double {
        get { drawn }
        set { drawn = newValue }
    }
}
