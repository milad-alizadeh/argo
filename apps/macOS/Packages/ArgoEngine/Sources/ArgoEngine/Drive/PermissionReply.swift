import Foundation

/// The hook's whole reply vocabulary — two words, over four things the gate can say.
///
/// Its own type: what goes down the socket is a pure function of what was decided, and the wire
/// format is worth reading in one place.
enum PermissionReply {
    /// Three answers, still two words. What makes `allowAlways` standing happens on Argo's side of
    /// the socket, and the hook is told the same `allow` either way. `ask` is unrepresentable, here
    /// and in the type.
    ///
    /// Switched exhaustively rather than tested against `.deny`, so a variant added to that enum
    /// cannot be swallowed by a fallback.
    static func line(_ decision: PermissionDecision) -> String {
        switch decision {
        case .allow, .allowAlways: line(word: "allow", reason: "Allowed in Argo")
        case .deny: line(word: "deny", reason: "Denied in Argo")
        }
    }

    /// What the gate says when its own clock ran out (#573). A `deny`, because the vocabulary has
    /// no third word — and a reason naming Argo, so the CLI's own record of the refused call cannot
    /// read as a person having refused it.
    static let expired = line(
        word: "deny",
        reason: "Permission expired in Argo — nobody answered",
    )

    private static func line(word: String, reason: String) -> String {
        CompanionResponse.line([
            "hookSpecificOutput": [
                "hookEventName": "PreToolUse",
                "permissionDecision": word,
                "permissionDecisionReason": reason,
            ],
        ]) ?? ""
    }
}
