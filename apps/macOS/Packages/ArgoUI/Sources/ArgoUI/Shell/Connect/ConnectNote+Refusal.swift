import ArgoEngine

/// Every way connecting can fail, said in the user's words.
///
/// The engine's refusals are the authority on WHICH failure happened and carry no copy at all,
/// which is the division that lets a provider's own words through untouched: `unreadable` and
/// `refused` put the provider's sentence in the `why` verbatim rather than rewording it into
/// Argo's voice, because that sentence is usually the only thing that says how to fix it.
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

/// A Binding on disk that no longer reads, said the same way. Separate from the refusals because
/// the two are answered at different moments: a refusal is a bind that never happened, and this is
/// a choice already made that has come undone — so every fix here is about the row as it stands.
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
