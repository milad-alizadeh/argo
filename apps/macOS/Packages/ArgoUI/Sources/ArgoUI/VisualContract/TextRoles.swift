/// The ink ramp: every rung the interface writes in.
///
/// Its own file rather than another block inside `ArgoPalette`, because it carries the one rule
/// in the palette that is a FUNCTION of the others — `marked(on:)` — and a rule is easier to find
/// beside the ramp it picks from than buried in the middle of six role groups.
public extension ArgoPalette {
    /// Every rung here is NEUTRAL, and that is a contract rather than a coincidence
    /// (`VisualContractTests` asserts it). A hue in this palette means something — brand, one of
    /// four operational states, one of two diff inks — and a rung of this ramp is a loudness, not
    /// a meaning. A run of text that is a different KIND rather than a different importance takes
    /// a ground, a weight or a face; never a colour off this ramp's budget.
    struct TextRoles: Sendable {
        /// Titles and row primaries.
        public let primary: ArgoColor
        /// The one quiet metadata line.
        public let secondary: ArgoColor
        /// Machine facts and non-essential detail.
        public let tertiary: ArgoColor
        public let disabled: ArgoColor
        /// On an Ion Blue fill.
        public let onAccent: ArgoColor

        public init(
            primary: ArgoColor,
            secondary: ArgoColor,
            tertiary: ArgoColor,
            disabled: ArgoColor,
            onAccent: ArgoColor,
        ) {
            self.primary = primary
            self.secondary = secondary
            self.tertiary = tertiary
            self.disabled = disabled
            self.onAccent = onAccent
        }

        /// The ramp loudest first, then the ink that only exists on a fill.
        public var all: [(name: String, color: ArgoColor)] {
            [
                ("primary", primary), ("secondary", secondary), ("tertiary", tertiary),
                ("disabled", disabled), ("onAccent", onAccent),
            ]
        }

        /// The rung a `code` span is set in, given the ink the prose around it is set in.
        ///
        /// The span INHERITS its voice — a marked run is not a louder claim than the sentence
        /// carrying it — but never falls below `secondary`, because the span sits on
        /// `surface.marked` and the ground lifts the backdrop out from under the quietest rung.
        /// A thought's span therefore reads one step up from the thought and still a step below
        /// a message's, so the voice hierarchy survives the floor.
        ///
        /// Expressed as a choice BETWEEN roles rather than as a value, so it holds under any
        /// appearance: a light palette inverts the luminances and this still picks the same rung.
        public func marked(on voice: ArgoColor) -> ArgoColor {
            voice == tertiary || voice == disabled ? secondary : voice
        }
    }
}
