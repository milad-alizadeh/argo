/// The one continuous measure the map bands, and the one exemption this contract takes from the
/// distance it holds between a hue and an operational state.
public extension ArgoPalette {
    /// Three ordered bands for one continuous measure — a TRAFFIC LIGHT: green, amber, red.
    ///
    /// It is the convention CodeCharta uses and the one every reader already owns, and it is the
    /// whole reason a band is legible before the legend is read. Luminance is not the ordering
    /// channel here; the hue is.
    ///
    /// **The exemption, stated the way `SeriesRoles` states its own.** The three bands sit inside
    /// the 0.25 this contract holds between a hue and an operational state — green 0.169 from
    /// `state.idle`, amber 0.212 from `state.attention`, red 0.203 from `state.failure` — and
    /// `MeasureRampTests` asserts each of those numbers rather than waiving them. What licenses it
    /// is that **no state role is ever drawn on the map**: a band and a status chip are never in
    /// one field of view, and amber meaning the same thing on a roof as on a chip is the reading
    /// being bought rather than the cost being paid. The exemption is three pairs wide and no
    /// wider — every other band-and-state pair, both diff inks and Ion Blue keep the full distance.
    ///
    /// A viridis ramp was tried, cleared every role, and was rejected on sight: it reads as a
    /// heatmap rather than a place, and it throws away the one thing a reader does not have to be
    /// taught.
    struct MeasureRoles: Sendable {
        /// Half the files.
        public let quiet: ArgoColor
        /// The band between the two.
        public let middling: ArgoColor
        /// The top 15%.
        public let hot: ArgoColor

        public init(quiet: ArgoColor, middling: ArgoColor, hot: ArgoColor) {
            self.quiet = quiet
            self.middling = middling
            self.hot = hot
        }

        /// Where green gives way to amber: half the files are quiet.
        public static let middlingFrom = 0.5
        /// Where amber gives way to red: the top 15% are hot.
        public static let hotFrom = 0.85

        /// The measure as a ramp — the value a legend draws and a file's colour is looked up in.
        ///
        /// Each band is TWO stops at the same colour, so the pass draws three hard edges rather
        /// than a wash, and so `ArgoRamp.color(at:)` returns a band exactly rather than something
        /// between two of them. A banded measure whose lookup interpolated would draw a file in a
        /// colour that is in no legend.
        public var ramp: ArgoRamp {
            ArgoRamp([
                .init(quiet, at: 0),
                .init(quiet, at: Self.middlingFrom),
                .init(middling, at: Self.middlingFrom),
                .init(middling, at: Self.hotFrom),
                .init(hot, at: Self.hotFrom),
                .init(hot, at: 1),
            ])
        }

        /// The bands in the order the measure runs, quiet first.
        public var all: [(name: String, color: ArgoColor)] {
            [("quiet", quiet), ("middling", middling), ("hot", hot)]
        }
    }
}
