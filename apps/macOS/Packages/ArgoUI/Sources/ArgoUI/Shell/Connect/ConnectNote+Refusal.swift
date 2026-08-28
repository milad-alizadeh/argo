import ArgoEngine

/// Every way connecting can fail, said in the user's words. The engine's refusals carry no copy at
/// all; `unreadable` and `refused` put the provider's own sentence in the `why` verbatim.
public extension ConnectNote {
    init(refusal: BindingRefusal) {
        switch refusal {
        case .noSuchProject:
            self.init(
                what: "Argo could not find this project.",
                why: "Its registration is no longer on this Mac.",
                fix: "Add the folder again.",
            )
        case .noSuchAccount:
            self.init(
                what: "That account is no longer on this Mac.",
                why: "It was removed while this panel was open.",
                fix: "Connect the account again, then pick it.",
            )
        case let .portNotServedByProvider(provider, port):
            self.init(
                what: "\(provider.readableName) cannot fill \(port.readableName.lowercased()).",
                why: "\(provider.readableName) does not carry that kind of work.",
                fix: "Pick an account with a provider that does.",
            )
        case .noGrant:
            self.init(
                what: "That account has no saved sign-in.",
                why: "Its token is not in this Mac's keychain.",
                fix: "Connect the account again.",
            )
        case .grantExpired:
            self.init(
                what: "That account's sign-in has expired.",
                why: "The provider stopped accepting its token.",
                fix: "Connect the account again.",
            )
        case let .scopeNotVisible(scope):
            self.init(
                what: "This account cannot see \(scope).",
                why: "It is not among what that account has access to.",
                fix: "Check the name, or pick an account that can see it.",
            )
        case .unauthorized:
            self.init(
                what: "The provider refused this account.",
                why: "Its access was revoked, or it has run out.",
                fix: "Connect the account again.",
            )
        case let .unreadable(reason):
            self.init(
                what: "Argo could not reach the provider.",
                why: reason,
                fix: "Check your connection, then try again.",
            )
        }
    }

    init(deviceFlow: GitHubDeviceFlowError, provider: AccountProvider) {
        let name = provider.readableName
        switch deviceFlow {
        case .declined:
            self.init(
                what: "\(name) did not authorize Argo.",
                why: "The request was cancelled on \(name)'s own screen.",
                fix: "Start again when you are ready.",
            )
        case .expired:
            self.init(
                what: "The code ran out.",
                why: "\(name) codes are good for a few minutes.",
                fix: "Ask for a new code.",
            )
        case .malformedResponse:
            self.init(
                what: "Argo could not read \(name)'s answer.",
                why: "The response was not in a shape Argo knows.",
                fix: "Try again. If it keeps happening, \(name) may be having trouble.",
            )
        case let .refused(code, description):
            self.init(
                what: "\(name) refused the sign-in.",
                why: description.isEmpty ? code : description,
                fix: "Read \(name)'s reason above, then try again.",
            )
        }
    }
}

/// Whichever flow the provider took, said in one place: the panel has one grant path and so has
/// one place a grant's failure becomes words.
public extension ConnectNote {
    init(grant: Error, provider: AccountProvider) {
        switch grant {
        case let deviceFlow as GitHubDeviceFlowError:
            self.init(deviceFlow: deviceFlow, provider: provider)
        case let authorization as LinearAuthorizationError:
            self.init(authorization: authorization, provider: provider)
        default:
            self.init(refusal: .unreadable(grant.localizedDescription))
        }
    }
}

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

public extension ConnectNote {
    /// A provider whose OAuth App this build does not carry, so there is nothing to sign in as.
    /// Here rather than at its one call site so the copy sweep can see it.
    static func notYetAuthorizable(_ provider: AccountProvider) -> ConnectNote {
        ConnectNote(
            what: "Argo cannot sign in to \(provider.readableName) yet.",
            why: "This build carries no \(provider.readableName) app to sign in as.",
            fix: "Use a GitHub account for now.",
        )
    }
}

/// A Binding on disk that no longer reads. Separate from the refusals, which are binds that never
/// happened.
public extension ConnectNote {
    init(fault: BindingFault) {
        switch fault {
        case .accountRemoved:
            self.init(
                what: "The account this row used is gone.",
                why: "It was removed from this Mac.",
                fix: "Pick another account, or connect that one again.",
            )
        case .portNotServedByProvider:
            self.init(
                what: "This row is set to a provider that cannot fill it.",
                why: "The setting was written outside Argo.",
                fix: "Pick an account with a provider that can.",
            )
        case .grantMissing:
            self.init(
                what: "This row's account has no saved sign-in.",
                why: "Its token is not in this Mac's keychain.",
                fix: "Connect the account again.",
            )
        case .grantExpired:
            self.init(
                what: "This row's sign-in has expired.",
                why: "The provider stopped accepting its token.",
                fix: "Connect the account again.",
            )
        }
    }
}
