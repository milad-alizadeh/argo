/// The ink ramp: every rung the interface writes in, plus `marked(on:)`, the one rule in the
/// palette that is a FUNCTION of the others.
public extension ArgoPalette {
    /// Every rung here is NEUTRAL, asserted by `VisualContractTests`. A hue in this palette means
    /// something — brand, one of four operational states, one of two diff inks — and a rung of this
    /// ramp is a loudness, not a meaning. A run of text that is a different KIND rather than a
    /// different importance takes a ground, a weight or a face; never a colour off this ramp.
    struct TextRoles: Sendable {
        /// Titles and row primaries.
        public let primary: ArgoColor
        /// The one quiet metadata line.
        public let secondary: ArgoColor
        /// Machine facts and non-essential detail.
        public let tertiary: ArgoColor
        public let disabled: ArgoColor
        /// On an Ion Blue fill — the loud rung, at full strength. Named for the GROUND it is read
        /// against and legible on that one alone: it is 1.24:1 on the deck. As of #1071 it is also
        /// a row voice, and the only one the selected backlog row is set in.
        public let onAccent: ArgoColor

        /// WCAG AA for body text. Every voice a row is SET in — `primary`, `secondary`,
        /// `tertiary` — clears it on `surface.base` AND on `interaction.selectionGround`, which
        /// are the two grounds a row is read on that the contract can name; an unselected
        /// sidebar row takes the platform's own material, so `base` stands in for it and the
        /// render is what checks the stand-in. `disabled` is an absence rather than a voice, so it
        /// is not held to it there — but it IS one of three voices on the third ground, the loud
        /// accent under a selected backlog row, where `onAccent` carries all three
        /// (`LoudSelectionGroundTests`, #1071). Stated because #922 was a ramp chosen against ONE
        /// ground and read on another.
        public static let contrastFloor = 4.5

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

        /// The rung a `code` span is set in, given the ink the prose around it is set in. The span
        /// INHERITS its voice but never falls below `secondary`, because it sits on
        /// `surface.marked` and that ground lifts the backdrop out from under the quietest rung.
        ///
        /// A choice BETWEEN roles rather than a value, so it holds under any appearance: a light
        /// palette inverts the luminances and this still picks the same rung.
        public func marked(on voice: ArgoColor) -> ArgoColor {
            voice == tertiary || voice == disabled ? secondary : voice
        }
    }
}
