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
    /// Held apart from the four operational states, from Ion Blue and from both diff inks by the
    /// same distance those four states are held apart from each other — so a slice can never read
    /// as a warning, as a selection or as a deleted line. `SeriesPaletteTests` asserts it, over
    /// every appearance.
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

        /// How much of a series' hue is laid down. A Gantt's spent, ordinary and live tasks are ONE
        /// hue at three strengths — three hues would read as three unrelated categories, and these
        /// are three states of the same thing (#905).
        public enum Weight: Sendable, CaseIterable {
            case spent, ordinary, full
        }

        /// The nth hue at one of those strengths.
        ///
        /// Alpha, and DOWNWARD from the hue itself, because this palette has nothing above it. A
        /// rung lifted a quarter of the way toward `text.primary` clears 5:1 and then sits 0.149
        /// from `diff.removed`, where the rule below wants 0.25 — the pink-wedge finding, walked
        /// into from the other side. So `full` IS the hue, and the two rungs under it are the
        /// exemption `SeriesPaletteTests` states and asserts: they clear neither the 3:1 mark floor
        /// nor the 0.25 held between hues, because at full the run is already only 3.35:1 and 0.278
        /// apart at its tightest, and there is no room under that for two more rungs that do.
        ///
        /// What licenses it is that a dimmed mark is not read the way a full one is. Its section
        /// comes from the heading over it and the row it sits on, and being quiet is its whole
        /// message; the 3:1 floor is for a mark whose own hue has to be identified across a feed.
        ///
        /// Evenly spaced would put `ordinary` and `full` closer together than the eye reads them
        /// apart, so the quiet end is stretched: 1.64 → 2.23 → 3.35 on the deck, at the tightest
        /// hue in the run.
        ///
        /// `opacity(_:)` REPLACES alpha rather than multiplying it. Every hue here is opaque, so
        /// these are the values they resolve at — a hue ever declared translucent would be lifted
        /// rather than dimmed, silently.
        public func hue(_ index: Int, at weight: Weight) -> ArgoColor {
            switch weight {
            case .spent: hue(index).opacity(0.44)
            case .ordinary: hue(index).opacity(0.68)
            case .full: hue(index)
            }
        }

        /// Every rung of one hue, quietest first.
        ///
        /// The ramp is DERIVED, so no reflected list can see it and the specimen has to draw it by
        /// hand — beside the full rung, so the weights are judged together. `design-system.md` asks
        /// that of every derived role, and it is the gate that catches a rung nobody looked at.
        public func ramp(_ index: Int) -> [(name: String, color: ArgoColor)] {
            Weight.allCases.map { ("\(name(index)) \($0)", hue(index, at: $0)) }
        }

        /// What a hue is called on the sheet: its place in the run, counted from one.
        private func name(_ index: Int) -> String {
            guard !hues.isEmpty else { return "series" }
            return "series\(((index % hues.count) + hues.count) % hues.count + 1)"
        }

        /// Every hue at FULL, named by its place — which is the only name an indexed role has.
        /// The rungs under each of them are `ramp(_:)`; this list is one third of what the family
        /// can draw.
        public var all: [(name: String, color: ArgoColor)] {
            hues.enumerated().map { (name($0.offset), $0.element) }
        }
    }
}
