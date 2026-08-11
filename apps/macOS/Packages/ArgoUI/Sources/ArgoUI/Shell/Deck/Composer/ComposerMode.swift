/// The Session's standing autonomy stance — a ladder whose rungs are boundaries, not prompt
/// frequencies: inside a rung the agent acts, at its edge a Permission fires (ADR-0025).
///
/// The one composer setting that must be readable without opening anything, which is why it sits
/// on the footer and never in a popover (design decision 1). The choice is still the composer's
/// own state; #545 is where a stance starts reaching the Session it names.
enum ComposerMode: String, CaseIterable, Identifiable {
    case readOnly = "Read Only"
    /// Shares `readOnly`'s boundary and differs by intent — the ladder's one deliberate pair, so
    /// a future edit must not collapse it (ADR-0025).
    case plan = "Plan"
    case code = "Code"
    case auto = "Auto"

    var id: Self {
        self
    }

    /// Where the rung stops. On the control's tooltip, not under each row.
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
