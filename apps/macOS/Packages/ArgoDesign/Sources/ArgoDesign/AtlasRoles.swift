/// What the Atlas draws a Project as: a place. Five families the rest of the contract has no use
/// for, held together rather than spread across it, because they are one reading (#1142).
///
/// The map is the one surface in this app that is not a document — it has a ground, a light, lit
/// plates and volumes standing on them, and a measure banded across the lot. None of that has a
/// meaning outside the map, and none of it licenses a hue anywhere else.
public extension ArgoPalette {
    /// The map's own contract: what a measure is banded into, how a domain gets its colour, and
    /// the materials the place itself is made of. The LIGHT is not here — it is `ArgoLight`,
    /// because a lamp does not change between appearances.
    struct AtlasRoles: Sendable {
        /// Three ordered bands for one continuous measure.
        public let measure: MeasureRoles
        /// A rule for colouring domains, whose count belongs to the repository.
        public let domain: DomainWheel
        /// The ground, the plates and the two greys a domain can resolve to.
        public let materials: MaterialRoles

        public init(measure: MeasureRoles, domain: DomainWheel, materials: MaterialRoles) {
            self.measure = measure
            self.domain = domain
            self.materials = materials
        }
    }

    /// The place itself: the ground the map is drawn on, the plates a folder's files stand on, the
    /// floor's own light, and the two readings a domain can have that are not a domain.
    ///
    /// A plate is lit ground, not a backdrop — the same lamp as everything else, dark enough that
    /// the files standing on it stay the subject.
    struct MaterialRoles: Sendable {
        /// The canvas ground. The contract names no other, because no other room has one: every
        /// room until now is documents on the deck.
        public let desktop: ArgoColor
        /// The top plate: a folder at the root of the map.
        public let plate1: ArgoColor
        /// One level in.
        public let plate2: ArgoColor
        /// Two levels in, and the deepest tone the map has. Nesting past three plates repeats it
        /// rather than inventing a fourth: three depths is what the eye reads off a tone.
        public let plate3: ArgoColor
        /// The floor's own light, which the contour grid takes. Cool, because the fill lamp is.
        public let fog: ArgoColor
        /// Belongs to nothing we can name. Deliberately a grey: an unassigned file is not a
        /// nineteenth domain, and a hue would make it read as one.
        public let unassigned: ArgoColor
        /// A domain that is not the one being looked at. Quieter than `unassigned`, because being
        /// out of focus and belonging to nothing are two different readings.
        public let hushed: ArgoColor
        /// The third honesty tier, which the contract had no vocabulary for: a domain is INFERRED
        /// rather than DIRECT or DERIVED, and every label on one is drawn in this.
        ///
        /// It IS `text.tertiary` rather than a new grey — a second quietest voice is a value
        /// nobody decided on. `AtlasMaterialTests` holds the two together.
        public let inferred: ArgoColor

        public init(
            desktop: ArgoColor,
            plate1: ArgoColor,
            plate2: ArgoColor,
            plate3: ArgoColor,
            fog: ArgoColor,
            unassigned: ArgoColor,
            hushed: ArgoColor,
            inferred: ArgoColor,
        ) {
            self.desktop = desktop
            self.plate1 = plate1
            self.plate2 = plate2
            self.plate3 = plate3
            self.fog = fog
            self.unassigned = unassigned
            self.hushed = hushed
            self.inferred = inferred
        }

        /// The three plate tones in depth order, for the contract's claims and the specimen — the
        /// same shape `SurfaceRoles.ramp` has, and read for the same reason: depth is the ORDER,
        /// and a ramp out of order is a map whose nesting reads inside out.
        public var plates: [(name: String, color: ArgoColor)] {
            [("plate1", plate1), ("plate2", plate2), ("plate3", plate3)]
        }

        /// Every material a volume or a region is read BESIDE, which is every one of them except
        /// the ink — `inferred` is drawn as words on a label, and a grey ink beside a grey state
        /// is not a confusion the map can make. The claims about what a colour may not resolve
        /// near run over this rather than over `all`.
        ///
        /// The list, rather than `all` minus a name: a catalogue filtered on a display label is a
        /// rule a caption can break.
        public var grounds: [(name: String, color: ArgoColor)] {
            [
                ("desktop", desktop), ("plate1", plate1), ("plate2", plate2), ("plate3", plate3),
                ("fog", fog), ("unassigned", unassigned), ("hushed", hushed),
            ]
        }

        public var all: [(name: String, color: ArgoColor)] {
            grounds + [("inferred", inferred)]
        }
    }
}
