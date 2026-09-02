import ArgoDesign
import ArgoEngine

/// How the composer says a rung of the ladder (ADR-0025). The engine owns the stance itself; this
/// is only the word, the mark and the boundary the footer draws it with.
extension SessionMode {
    /// The rung's own word, and the only name any surface calls it by.
    var label: String {
        switch self {
        case .readOnly: "Read Only"
        case .plan: "Plan"
        case .code: "Code"
        case .auto: "Auto"
        }
    }

    /// Where the rung stops. On the control's tooltip, not under each row: the rows take a word
    /// and a mark (design decision 1).
    var boundary: String {
        switch self {
        case .readOnly: "no writes"
        case .plan: "no writes, proposes"
        case .code: "the Workspace"
        case .auto: "no boundary"
        }
    }

    /// The rung's mark, frozen by the composer design (#608).
    var mark: String {
        switch self {
        case .readOnly: ArgoSymbol.modeReadOnly
        case .plan: ArgoSymbol.modePlan
        case .code: ArgoSymbol.modeCode
        case .auto: ArgoSymbol.modeAuto
        }
    }
}
