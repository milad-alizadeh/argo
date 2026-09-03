/// A domain's colour, as a rule rather than as a run of colours.
public extension ArgoPalette {
    /// Domains are categorical and their COUNT belongs to the repository, so what the contract can
    /// hold is the rule: a hue around the wheel at a fixed lightness, at a saturation that carries
    /// how sure we are.
    ///
    /// `SeriesRoles`' eight hues would wrap at this repo's seventeen domains, and two domains
    /// sharing a colour is the one thing the tint view exists to make visible.
    ///
    /// **Two things stated rather than fixed.** The four operational states are exempt here —
    /// unlike for `MeasureRoles`, this one needs no argument about what is beside what: a
    /// categorical hue carries no good-or-bad reading to carry over, which is exactly what an
    /// ordered green-amber-red ramp does carry and why that one was not exempt. And below full
    /// confidence a domain DOES approach grey, deliberately: washed out means unsure, and the two
    /// readings are one continuum.
    ///
    /// Past about thirty domains adjacent hues stop being tellable apart at any saturation, which
    /// is why every region is named on the map and in the rail — the colour is an aid to a name,
    /// never the identifier.
    struct DomainWheel: Sendable {
        /// A domain we are unsure of arrives washed out.
        public let saturationLeast: Double
        /// Saturation carries confidence; hue carries identity.
        ///
        /// Measured, not chosen. At full confidence the wheel must stay clear of the only things
        /// beside it ON THE MAP — `materials.unassigned`, `materials.hushed`, the three plate tones
        /// and `materials.fog`. At 0.38 a 21-domain repo puts one region 0.247 from `unassigned`,
        /// which would read as "belongs to nothing"; at 0.44 the worst case over every count from
        /// 2 to 40 is 0.282. `DomainWheelTests` asserts that number.
        public let saturationFull: Double
        /// One lightness for every domain: a region is not lighter for being bigger or older.
        public let lightness: Double
        /// The golden angle, so adjacent ranks are never neighbours in hue — and so the run never
        /// wraps, whatever a repository's domain count turns out to be.
        public let turn: Double

        public init(
            saturationLeast: Double,
            saturationFull: Double,
            lightness: Double,
            turn: Double,
        ) {
            self.saturationLeast = saturationLeast
            self.saturationFull = saturationFull
            self.lightness = lightness
            self.turn = turn
        }

        /// The colour for the domain at `rank`, at how sure we are it is a domain.
        ///
        /// `confidence` clamps: a value outside 0…1 is arithmetic that went somewhere, and the
        /// answer to it is the end of the range rather than a region drawn louder than the wheel's
        /// own ceiling.
        public func hue(_ rank: Int, confidence: Double = 1) -> ArgoColor {
            let held = min(max(confidence, 0), 1)
            return ArgoColor(
                hue: Double(rank) * turn,
                saturation: saturationLeast + (saturationFull - saturationLeast) * held,
                lightness: lightness,
            )
        }

        /// The first `count` ranks — what a repository with that many domains is drawn in, and
        /// what the specimen puts on the sheet.
        public func wheel(count: Int, confidence: Double = 1) -> [ArgoColor] {
            (0 ..< max(count, 0)).map { hue($0, confidence: confidence) }
        }
    }
}
