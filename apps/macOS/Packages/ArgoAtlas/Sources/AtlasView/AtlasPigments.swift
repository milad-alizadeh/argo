import ArgoDesign
import AtlasLayout

/// What every face of the map is painted in, resolved from the contract once (#1147).
///
/// A value rather than a reach into the environment, for the reason every view here takes resolved
/// colours: the one thing that decides what the GPU is handed is this type's input, which is the
/// only way the faces can be built without a window and asserted on.
struct AtlasPigments {
    private let measure: ArgoPalette.MeasureRoles
    private let materials: ArgoPalette.MaterialRoles

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
        self.edge = rim
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

    /// The ground the whole city stands on.
    var desktop: ArgoColor {
        materials.desktop
    }
}
