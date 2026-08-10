/// How present a surface is, when the answer is "less than fully".
///
/// Its own family rather than a rung on the ink ramp, because what it dims is a WHOLE surface —
/// title, branch, age and the state dot together — and a ramp can only ever answer for one run of
/// text at a time. A fact about the row is drawn on the row; a fact about a word is drawn on the
/// word (`rules/design-system.md`, "a ground, a weight, a face" before a hue).
public enum ArgoOpacity {
    /// Fully present. Worth one and kept anyway: it is the control group that gives `ghosted`
    /// something to be measured against, and it lets a view spell both arms of a choice in the
    /// contract's own names rather than dropping to a bare `1` for the ordinary case.
    public static let full: Double = 1
    /// A surface the user cannot drive: an observed Session's roster row, read-only because Argo
    /// never owned its terminal.
    ///
    /// Clearly quieter than a row beside it and still a row you can switch to by reading —
    /// `VisualContractTests` holds it above the ramp's own `disabled` rung, which is the floor for
    /// ink that is inert rather than absent. Dimmer than that and the roster would be asking to be
    /// leaned into; brighter and the ghosting stops reading as a state.
    public static let ghosted: Double = 0.6

    /// Every rung, for the specimen and its coverage check. `ghosted` is looked at on the real
    /// surface by the `ghostedRows` specimen, which is a roster mixing driveable rows with rows
    /// that are not.
    public static let all: [(name: String, value: Double)] = [
        ("full", full), ("ghosted", ghosted),
    ]
}
