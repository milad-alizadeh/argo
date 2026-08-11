/// How present a surface is, when the answer is "less than fully".
///
/// Its own family rather than a rung on the ink ramp: what it dims is a WHOLE surface — title,
/// branch, age and the state dot together — and a ramp answers for one run of text at a time
/// (`rules/design-system.md`).
public enum ArgoOpacity {
    /// Fully present. Worth one and kept anyway: it lets a view spell both arms of a choice in the
    /// contract's own names rather than dropping to a bare `1`.
    public static let full: Double = 1
    /// A surface the user cannot drive: an observed Session's roster row.
    ///
    /// `VisualContractTests` holds it above the ramp's own `disabled` rung, the floor for ink that
    /// is inert rather than absent.
    public static let ghosted: Double = 0.6

    /// Every rung, for the contract sheet's `presence` section. `ghosted` is looked at on the real
    /// surface too, by the `ghostedRows` specimen.
    public static let all: [(name: String, value: Double)] = [
        ("full", full), ("ghosted", ghosted),
    ]
}
