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
        [("ion", ion)]
    }
}
