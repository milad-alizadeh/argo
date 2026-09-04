/// How far a Plan got, as ink. Its own file because the group carries a rule of its own: progress
/// is not a state, and the one colour it is allowed is the brand hue at a second weight.
public extension ArgoPalette {
    /// The Plan's own ink. Progress is NOT an operational state, and a row already spends the
    /// running teal on its dot and on a live Turn clock, so a Plan's segments take the accent.
    ///
    /// One role: the resting weight. A to-do item still moving is `interaction.accent` itself, by
    /// name rather than by a second literal here.
    struct ProgressRoles: Sendable {
        /// A Plan that has stopped moving: the accent, banked. Same hue as `interaction.accent`,
        /// dropped to where it cannot be mistaken for live.
        ///
        /// Held ABOVE `text.disabled` on the deck, because it says how far the work got and that
        /// ink is an absence (#1341). `VisualContractTests` holds both halves, the hue and the
        /// presence.
        public let still: ArgoColor

        public init(still: ArgoColor) {
            self.still = still
        }

        public var all: [(name: String, color: ArgoColor)] {
            [("still", still)]
        }
    }
}
