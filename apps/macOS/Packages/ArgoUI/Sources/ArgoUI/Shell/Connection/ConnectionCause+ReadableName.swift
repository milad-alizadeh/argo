import ArgoEngine

/// The cause words as the status registry spells them, which is not how Swift spells the cases.
///
/// One place decides, for the reason `AccountProvider.readableName` is one place — and here it is
/// also the difference between Argo's vocabulary and its own source code leaking into the chip:
/// `rateLimited` is two words on screen and always has been.
extension ConnectionCause {
    var readableName: String {
        switch self {
        case .offline: "offline"
        case .unreachable: "unreachable"
        case .rateLimited: "rate limited"
        }
    }
}
