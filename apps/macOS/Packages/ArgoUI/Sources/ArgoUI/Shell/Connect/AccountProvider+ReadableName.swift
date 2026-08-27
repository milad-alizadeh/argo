import ArgoEngine

/// How a provider is spelled on screen, and what it calls the thing a Binding points at.
///
/// One place decides, for the reason `ArgoSymbol` is one place: the row, the menu, the refusal and
/// the spoken label all name the same provider, and four spellings of "GitHub" is how a surface
/// starts reading as four different features.
extension AccountProvider {
    var readableName: String {
        switch self {
        case .github: "GitHub"
        case .linear: "Linear"
        }
    }

    /// What the provider calls a scope, in its own words. GitHub binds a repository, Linear a team
    /// — the field's label has to be the word the user would use with that provider, not Argo's
    /// internal "scope".
    var scopeNoun: String {
        switch self {
        case .github: "Repository"
        case .linear: "Team"
        }
    }
}
