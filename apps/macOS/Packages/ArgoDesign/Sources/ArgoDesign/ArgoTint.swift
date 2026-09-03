/// How much of a hue is laid down when the hue is not the subject — a ground under a word, an edge
/// around a vessel, a whole surface lit up.
///
/// One ladder rather than a set of opacities spelled per family: a wash means the same strength
/// wherever it is read, and two families drifting apart on what "muted" is worth is exactly what a
/// contract exists to stop. `StateRoles` spends it on an operational state, `InteractionRoles` on
/// the brand hue.
///
/// It is NOT `SeriesRoles.Weight`, which dims a MARK — a bar that is quiet is still the subject.
/// These three are grounds and edges around something else.
public enum ArgoTint: Double, Sendable, CaseIterable {
    /// A whole surface while it invites something, read THROUGH by a field and two controls.
    case wash = 0.1
    /// A chip's ground: one word is read on it.
    case muted = 0.16
    /// The EDGE of a surface rather than an ink on it. Louder, because nothing is read on it.
    case rim = 0.5

    /// What a rung is called on the contract sheet, under the hue it is laid down from.
    public var name: String {
        switch self {
        case .wash: "wash"
        case .muted: "muted"
        case .rim: "rim"
        }
    }
}
