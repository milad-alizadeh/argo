import ArgoDesign
import AtlasLayout

/// What every face of the map is painted in, resolved from the contract once (#1147).
///
/// A value rather than a reach into the environment, for the reason every view here takes resolved
/// colours: the one thing that decides what the GPU is handed is this type's input, which is the
/// only way the faces can be built without a window and asserted on.
///
/// `Equatable` because the city is a function of the plan and of this, and of nothing else: it is
/// half of what `AtlasCityCache` asks to know whether the boxes have to be built again (#1598).
/// Synthesized off the role families, so a material added to the contract is compared without
/// being named here.
struct AtlasPigments: Equatable {
    private let measure: ArgoPalette.MeasureRoles
    private let materials: ArgoPalette.MaterialRoles

    /// How a Domain gets its colour, as a RULE rather than a run of colours (#1158): the count
    /// belongs to the repository, so no list the contract could hold would be long enough.
    ///
    /// Read off the contract here rather than spelled again, which is the whole reason the wheel
    /// is a rule at all — the saturation it runs at is measured (0.282 clear of everything else on
    /// the map at worst, over every count from 2 to 40), and a second copy of it here would be a
    /// second number to lower.
    private let domain: ArgoPalette.DomainWheel

    /// The edge one plate is told from the next by, as the contract spells it: a wash, carrying an
    /// opacity.
    ///
    /// `edge.hairline` is the contract's own answer to this exact question — a separator between
    /// two surfaces of the SAME tone — and the map needs it for the reason a document does: three
    /// plate tones repeat past the third level of nesting, so beyond that the ground alone stops
    /// saying where one folder ends. Not a lit rim: the light model (#1151) runs in the shader, on
    /// this flat pigment, never here — resolving it before the GPU sees it is what the design's
    /// own rule forbids.
    private let edge: ArgoColor

    init(_ atlas: ArgoPalette.AtlasRoles, rim: ArgoColor) {
        self.measure = atlas.measure
        self.materials = atlas.materials
        self.domain = atlas.domain
        self.edge = rim
    }

    /// What one tile is drawn in — the file's Domain where the map is tiled by domain, and its
    /// measured band where it is tiled by folder (#1158).
    ///
    /// ONE question with one answer, asked of the tile rather than of two channels at the call
    /// site: the tile carries a Domain exactly where the map was grouped by one, so there is
    /// nowhere for a rectangle to be handed both readings and no flag here to fall out of step
    /// with the tiling.
    func pigment(of tile: AtlasTile) -> ArgoColor {
        switch tile.domain {
        // Confidence rides on SATURATION and never on hue: a Domain we are unsure of arrives
        // washed out, in the same place on the wheel it would have arrived at sure. Moving it
        // would make unsure look like a different subject rather than like a weaker claim.
        case let .placed(rank, confidence):
            domain.hue(rank, confidence: confidence)
        // The one grey a Domain can resolve to. Not the wheel at zero confidence, which is still a
        // hue and would read as a nineteenth domain — the file belongs to nothing, which is a
        // different sentence from "barely belongs to this".
        case .unassigned:
            materials.unassigned
        case nil:
            pigment(of: tile.band)
        }
    }

    /// What a file is drawn in: its band's own swatch, and nothing multiplied into it.
    ///
    /// A file the repository never measured is drawn `unassigned` — a grey. Unmeasured is not the
    /// least of something, and a green rectangle would put a claim on the map that no number
    /// stands behind.
    func pigment(of band: AtlasBand?) -> ArgoColor {
        switch band {
        case .quiet: measure.quiet
        case .middling: measure.middling
        case .hot: measure.hot
        case nil: materials.unassigned
        }
    }

    /// The ground a folder's files stand on. The contract gives three tones and repeats the
    /// deepest past that, which is what the eye reads off a tone — the fixture nests eleven levels
    /// and eleven tones would be eleven greys nobody can order.
    func plate(at depth: Int) -> ArgoColor {
        let tones = materials.plates
        return tones[min(max(depth, 0), tones.count - 1)].color
    }

    /// The border round a plate at one depth, RESOLVED against the ground it is drawn on.
    ///
    /// The shader does not blend — every face reaching it is opaque — so an 8% white wash handed
    /// over as-is arrives as white. It is composited here instead, against the plate the border
    /// lies on, which is the one below this one.
    func rim(at depth: Int) -> ArgoColor {
        edge.composited(over: depth > 0 ? plate(at: depth - 1) : desktop)
    }

    /// The ground the whole city stands on, and the OUTERMOST stop of the graded one (#1600).
    var desktop: ArgoColor {
        materials.desktop
    }

    /// The ground where the lamp reaches it, at the middle of the plan — the middle stop of the
    /// grade (#1600).
    var groundLit: ArgoColor {
        materials.groundLit
    }

    /// The dip half way out, before the grade returns to `desktop` at the rim (#1600).
    var groundDeep: ArgoColor {
        materials.groundDeep
    }

    /// The floor's own light: what every patch laid on the floor is drawn in, the plates' own and
    /// the contour grid alike (#1600). The contract's own words for it — "the floor's own light,
    /// which the contour grid takes" — so nothing on the floor names a second one.
    var fog: ArgoColor {
        materials.fog
    }
}
