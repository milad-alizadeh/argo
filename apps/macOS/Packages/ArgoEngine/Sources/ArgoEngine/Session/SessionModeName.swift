/// The word a rung is WRITTEN DOWN as, in Argo's own per-machine files.
///
/// Never `ClaudePermissionMode`'s vocabulary: that one answers `plan` for two rungs, so a file
/// written through it would forget which of them was meant.
///
/// Spelled here rather than derived from the enum's case names, so renaming a case cannot quietly
/// change what is already on disk. Two files read it — the rung last picked (#629) and the
/// ownership ledger's starting rung (#966) — which is why it is one mapping rather than each
/// file's own.
enum SessionModeName {
    static func of(_ mode: SessionMode) -> String {
        switch mode {
        case .readOnly: "readOnly"
        case .plan: "plan"
        case .code: "code"
        case .auto: "auto"
        }
    }

    static func rung(named name: String) -> SessionMode? {
        switch name {
        case "readOnly": .readOnly
        case "plan": .plan
        case "code": .code
        case "auto": .auto
        default: nil
        }
    }
}
