import ArgoEngine

/// Every way a redirect grant can fail — Linear's shape, where GitHub's is a device code (#371).
public extension ConnectNote {
    init(authorization: LinearAuthorizationError, provider: AccountProvider) {
        let name = provider.readableName
        switch authorization {
        case .notRegistered:
            self = .notYetAuthorizable(provider)
        case .redirectUnavailable:
            self.init(
                what: "Argo could not listen for \(name)'s answer.",
                why: "Another app on this Mac is already using the port it comes back on.",
                fix: "Close any other copy of Argo, then try again.",
            )
        case .abandoned:
            self.init(
                what: "\(name) did not come back.",
                why: "The page was closed, or it was left too long.",
                fix: "Start again when you are ready.",
            )
        case .stateMismatch:
            self.init(
                what: "Argo refused the answer that came back.",
                why: "It did not match the request Argo sent, so it was not this sign-in.",
                fix: "Start again, and finish in the page Argo opens.",
            )
        case let .refused(reason):
            self.init(
                what: "\(name) refused the sign-in.",
                why: reason,
                fix: "Read \(name)'s reason above, then try again.",
            )
        case .malformedResponse:
            self.init(
                what: "Argo could not read \(name)'s answer.",
                why: "The response was not in a shape Argo knows.",
                fix: "Try again. If it keeps happening, \(name) may be having trouble.",
            )
        }
    }
}
