import ArgoDesign
import AtlasLayout
import SwiftUI

/// One length of light passing along one cord (#1425).
///
/// The map's second loop, and the reason it is a loop at all: a cord reports that a dependency is
/// live, and nothing ends that but the map closing (`ArgoMotion.travel`). What repeats is the
/// travel; the cord underneath is drawn whether it runs or not, which is why Reduce Motion can
/// simply stop it and leave the reading whole.
///
/// A head that LEADS and a tail that follows, in two strokes: a long soft tail that carries the
/// motion and a short bright core that is the thing the eye actually catches. One blob sliding
/// along reads as an object on the cord rather than as something passing through it.
struct AtlasTravel {
    /// How much of the cord the tail spans, and how much the core does — the approved render's own
    /// `TRAVEL_SPAN` and its core (`docs/designs/cockpit-atlas.html`, `filaments`).
    static let span = 0.30
    static let core = 0.075

    /// How far past the start of the cord the head begins its lap. The travel runs from before the
    /// first roof to past the second, so the light arrives and leaves rather than appearing in the
    /// middle of a cord and vanishing there.
    static let lead = 0.2

    /// How far apart in the lap two cords next to each other are. ONE clock drives every cord and
    /// this is what stops them pulsing in unison — a second clock would be a third repeating role,
    /// and the contract has two (`MotionContractTests`).
    static let phaseStep = 0.137

    /// The shortest cord worth a traveller, in points. Under this the head and its tail are on top
    /// of each other and the light reads as the cord flickering.
    static let shortestRun: CGFloat = 24

    /// How much of the cord's own colour the core is drawn at, before the tie's strength spends
    /// the rest, and the share of that the soft tail keeps. The render's own two numbers.
    static let brightest = 0.34
    static let byStrength = 0.5
    static let ofTheTail = 0.42

    /// Where along its own length the beam is brightest. Past the middle, so the light is thickest
    /// just behind its head — which is what makes the head lead rather than the length glow.
    static let brightestAt = 0.72

    /// How much wider than its cord each of the two strokes is drawn.
    static let tailWidth: CGFloat = 2.6
    static let coreWidth: CGFloat = 1.15

    let cord: AtlasDrawnCord

    /// Where the head is, in the cord's own parameter. Below 0 and past 1 at the two ends of the
    /// lap, which is what puts the arriving and the leaving off the ends of the cord.
    let head: Double

    init(along cord: AtlasDrawnCord, at place: Int, into lap: Double) {
        self.cord = cord
        let phase = (lap + Double(place) * Self.phaseStep).truncatingRemainder(dividingBy: 1)
        self.head = Self.glide(phase) * (1 + Self.span) - Self.span * Self.lead
    }

    /// The two strokes, at the strength of the tie and the presence of the layer it belongs to.
    func draw(in context: inout GraphicsContext, as colour: ArgoColor, at presence: Double) {
        guard run >= Self.shortestRun, presence > 0 else { return }
        let bright = (Self.brightest + cord.coupling.strength * Self.byStrength) * presence
        beam(
            in: &context,
            from: head - Self.span,
            as: colour.color.opacity(cord.weight.alpha * bright * Self.ofTheTail),
            width: cord.width * Self.tailWidth,
        )
        beam(
            in: &context,
            from: head - Self.core,
            as: colour.color.opacity(cord.weight.alpha * bright),
            width: cord.width * Self.coreWidth,
        )
    }

    /// One length of the arc, faded in from its own tail and out at its own head, so nothing
    /// starts or stops abruptly. Clipped to the cord: the head runs off both ends of it, and a
    /// beam drawn past a roof would be light leaving a file it does not touch.
    private func beam(
        in context: inout GraphicsContext,
        from tail: Double,
        as colour: Color,
        width: CGFloat,
    ) {
        let first = max(0, tail)
        let last = min(1, head)
        guard last - first >= Self.shortest else { return }
        context.stroke(
            path(from: first, to: last),
            with: .linearGradient(
                // `.clear` at both ends rather than the colour at no opacity: what is there is
                // nothing, which is not an opacity anybody chose.
                Gradient(stops: [
                    .init(color: .clear, location: 0),
                    .init(color: colour, location: Self.brightestAt),
                    .init(color: .clear, location: 1),
                ]),
                startPoint: cord.cord.point(at: first),
                endPoint: cord.cord.point(at: last),
            ),
            style: StrokeStyle(lineWidth: width, lineCap: .round),
        )
    }

    /// The shortest length of arc worth a stroke. Under it the gradient's three stops land inside
    /// a point or two and the beam reads as a dot rather than as a length of light.
    private static let shortest = 0.015

    /// How many points the beam is drawn as. Sampled by the curve's own parameter rather than
    /// trimmed by arc length, so the gradient's two ends are the two ends of the stroke — a
    /// gradient anchored somewhere the ink is not slides the bright part off the beam.
    private static let steps = 12

    private func path(from first: Double, to last: Double) -> Path {
        Path { path in
            path.move(to: cord.cord.point(at: first))
            for step in 1 ... Self.steps {
                let along = first + (last - first) * Double(step) / Double(Self.steps)
                path.addLine(to: cord.cord.point(at: along))
            }
        }
    }

    /// How far apart the two roofs landed, which decides whether there is a cord to travel at all.
    private var run: CGFloat {
        let across = cord.cord.end.x - cord.cord.start.x
        let down = cord.cord.end.y - cord.cord.start.y
        return (across * across + down * down).squareRoot()
    }

    /// Eased at BOTH ends, so a traveller arrives and leaves rather than marching. The render's own
    /// `glide`: the smoothest step whose first and second derivatives are zero at each end, which
    /// is what a loop needs — an ease that only flattens at one end reads as a stutter once a lap.
    static func glide(_ share: Double) -> Double {
        share * share * share * (share * (share * 6 - 15) + 10)
    }
}
