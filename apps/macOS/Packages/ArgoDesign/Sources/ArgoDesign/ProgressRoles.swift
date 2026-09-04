/// How far a Plan got, as ink. Its own file because the group carries a rule of its own: progress
/// is not a state, and the one colour it is allowed is the brand hue at a second weight.
public extension ArgoPalette {
    /// The Plan's own ink. Progress is NOT an operational state — a row already spends the
    /// running teal on its dot and on a live Turn clock — so the segments a Plan is drawn as take
    /// the accent, and this is the accent banked.
    ///
    /// The group holds only the resting weight. A to-do item still moving is
    /// `interaction.accent` itself, by name rather than by a second literal here.
    struct ProgressRoles: Sendable {
        /// A Plan that has stopped moving: the accent, banked. Same hue as
        /// `interaction.accent`, dropped to where it cannot be mistaken for live.
        ///
        /// It stays legible as HOW FAR THE WORK GOT, which is why it is not `text.disabled`:
        /// that ink is an absence, and a finished plan drawn in it reads as a plan nobody
        /// started. `VisualContractTests` holds both halves — the hue, and the presence.
        public let still: ArgoColor

        public init(still: ArgoColor) {
            self.still = still
        }

        public var all: [(name: String, color: ArgoColor)] {
            [("still", still)]
        }
    }
}
