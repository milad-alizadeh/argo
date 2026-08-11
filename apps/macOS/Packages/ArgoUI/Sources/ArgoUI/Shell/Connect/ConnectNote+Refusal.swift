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

public extension ConnectNote {
    /// A provider Argo cannot sign in to yet. Here rather than at its one call site so the copy
    /// sweep can see it.
    static func notYetAuthorizable(_ provider: AccountProvider) -> ConnectNote {
        ConnectNote(
            what: "Argo cannot sign in to \(provider.readableName) yet.",
            why: "That connection is still being built.",
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
