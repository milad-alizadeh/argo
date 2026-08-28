/// The hues categorical data is drawn in: a pie's slices today, a bar chart's bars and a Gantt's
/// sections next.
public extension ArgoPalette {
    /// The one place this palette spends a hue on a KIND rather than on a meaning — and it is the
    /// case the rationing rule leaves room for rather than a hole in it. Telling the third slice
    /// from the fourth is the whole job of a chart, and a ground, a weight or a face cannot say it.
    ///
    /// It is sealed the way the other two exemptions are: a hue here is correct INSIDE a chart and
    /// licenses nothing outside one. Nothing in the shell reads a series role.
    ///
    /// Held apart from the four operational states and from Ion Blue by the same distance those
    /// four are held apart from each other, so a slice can never read as a warning or as a
    /// selection. `SeriesPaletteTests` asserts it, over every appearance.
    struct SeriesRoles: Sendable {
        /// The run, in the order a chart spends it. Longer than any chart written in a message
        /// needs; a series past the end WRAPS rather than running out — see `hue(_:)`.
        public let hues: [ArgoColor]

        public init(hues: [ArgoColor]) {
            self.hues = hues
        }

        /// The hue for the nth series, counted from zero and wrapping in both directions.
        ///
        /// Wrapping rather than clamping, and predictably: a ninth entry repeats the first, which
        /// reads as two entries far apart in the legend. Clamping would draw the last three
        /// entries as one colour, which reads as an error nobody made.
        public func hue(_ index: Int) -> ArgoColor {
            guard !hues.isEmpty else { return .transparent }
            return hues[((index % hues.count) + hues.count) % hues.count]
        }

        /// Every hue, named by its place — which is the only name an indexed role has.
        public var all: [(name: String, color: ArgoColor)] {
            hues.enumerated().map { ("series\($0.offset + 1)", $0.element) }
        }
    }
}
