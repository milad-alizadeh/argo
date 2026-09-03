/// The brand hue laid down as a ground or an edge rather than drawn as an ink.
public extension ArgoPalette.InteractionRoles {
    /// Ion Blue at one of the three weights a tint is laid down at.
    ///
    /// The same ladder `StateRoles` spends, and deliberately the same numbers: a wash is a wash
    /// wherever it is read. What it is FOR here is the Atlas — a picked volume takes a rim, a
    /// searched-for region takes a wash, and neither is `selectionGround`, which is an opaque
    /// ground for a roster row and composites onto nothing.
    ///
    /// Derived rather than stored, so `Mirror` cannot reach these and no reflected list can catch
    /// one going undrawn. `ladder` is what stands in, and the specimen draws it by hand.
    func accent(at tint: ArgoTint) -> ArgoColor {
        accent.opacity(tint.rawValue)
    }

    /// Every rung, quietest first — the catalogue the contract sheet draws and the claims run
    /// over.
    var ladder: [(name: String, color: ArgoColor)] {
        ArgoTint.allCases.map { ("accent \($0.name)", accent(at: $0)) }
    }
}
