import SwiftUI

/// An ordered colour ramp: which role sits where along one pass. Held as roles and fractions rather
/// than as a `Gradient` for the reason `ArgoColor` is held as components — nothing can ask a
/// `Gradient` what it is, so the ramp's claims would not be assertable.
public struct ArgoRamp: Sendable {
    public struct Stop: Sendable {
        public let color: ArgoColor
        /// Where along the pass, 0 at the tail and 1 at the head.
        public let location: Double

        public init(_ color: ArgoColor, at location: Double) {
            self.color = color
            self.location = location
        }
    }

    /// Tail first. Order is the whole content of a ramp: the same stops shuffled draw bands.
    public let stops: [Stop]

    public init(_ stops: [Stop]) {
        self.stops = stops
    }

    /// What the ramp resolves to at one point along it — the lookup banding a measure is made of,
    /// and the one thing a `LinearGradient` cannot be asked.
    ///
    /// The fraction CLAMPS: it arrives from arithmetic over a repository, and a division that went
    /// somewhere resolves to an end of the ramp rather than to nothing.
    ///
    /// A band is two stops at one colour, and a pair of stops that share a colour returns it
    /// exactly rather than mixing it with itself — floating-point arithmetic on identical
    /// endpoints does not always land back on the endpoint, and a banded measure whose lookup
    /// missed its own band by a thousandth is a file drawn in a colour that is in no legend.
    public func color(at fraction: Double) -> ArgoColor {
        guard let first = stops.first, let last = stops.last else { return .transparent }
        let point = min(max(fraction, 0), 1)
        guard point > first.location else { return first.color }
        guard point < last.location else { return last.color }
        // The LAST pair that spans the point, so a point on a band edge belongs to the louder
        // band: a file at the boundary is reported up, never down.
        var span = (lower: first, upper: last)
        for pair in zip(stops, stops.dropFirst())
            where pair.0.location <= point && point <= pair.1.location {
            span = (pair.0, pair.1)
        }
        guard span.lower.color != span.upper.color else { return span.upper.color }
        let width = span.upper.location - span.lower.location
        guard width > 0 else { return span.upper.color }
        return span.lower.color.mixed(
            with: span.upper.color,
            by: (point - span.lower.location) / width,
        )
    }

    /// The ramp as one horizontal pass, tail at the leading edge. Every surface takes the pass
    /// rather than the stops, so no call site can spend the ramp running the other way.
    public var pass: LinearGradient {
        LinearGradient(
            gradient: Gradient(stops: stops.map {
                .init(color: $0.color.color, location: $0.location)
            }),
            startPoint: .leading,
            endPoint: .trailing,
        )
    }
}

public extension ArgoPalette {
    /// The ion — Argo's own substance, `interaction` running into `state.running`. A deep blue tail
    /// into a mint head, so a pass has a DIRECTION: the head is where the work is.
    ///
    /// Both ends are the ADJACENT role at zero opacity rather than a clear black. SwiftUI
    /// interpolates the channels alongside the alpha, so a clear black fades a pass out through
    /// grey.
    var ion: ArgoRamp {
        ArgoRamp([
            .init(interaction.accentDeep.opacity(0), at: 0),
            .init(interaction.accentDeep, at: 0.28),
            .init(interaction.accent, at: 0.55),
            .init(interaction.accentBright, at: 0.76),
            .init(state.running, at: 0.88),
            .init(state.running.opacity(0), at: 1),
        ])
    }

    /// Every ramp — the `all` of this family, for the specimen and the assertions. A ramp is
    /// DERIVED from roles rather than stored beside them, so `Mirror` cannot reach it and this
    /// list is what one has to appear in to be drawn and to be checked.
    var ramps: [(name: String, ramp: ArgoRamp)] {
        [("ion", ion), ("measure", atlas.measure.ramp)]
    }
}
