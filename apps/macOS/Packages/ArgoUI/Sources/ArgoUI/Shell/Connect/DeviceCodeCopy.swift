import ArgoEngine

/// What the waiting card says, as values. Outside the view for the reason `WelcomeCopy` is: the
/// copy rules are claims about every word on screen, and a `View` is `@MainActor` while the suite
/// that sweeps them is not.
enum DeviceCodeCopy {
    static let copy = "Copy code"
    static let copied = "Copied"
    static let stop = "Stop waiting"
    static let waiting = "Argo is waiting for you to finish in the browser."

    /// Named for the provider, because the user is being sent to that provider's own screen and
    /// "the provider" is not what it is called there. Two headings, because the two flows ask for
    /// different things: a code to type, or a page already open.
    static func heading(for challenge: ConnectChallenge) -> String {
        let name = challenge.provider.readableName
        return challenge.userCode == nil
            ? "Approve Argo in \(name)"
            : "Type this code at \(name)"
    }

    /// The address the link reads as. A redirect flow's URL is long and carries the request's own
    /// secrets, so the link is named rather than spelled out — a device flow's is short and IS the
    /// instruction.
    static func address(of challenge: ConnectChallenge) -> String {
        challenge.userCode == nil
            ? "Open \(challenge.provider.readableName) again"
            : challenge.verificationURL.absoluteString
    }

    /// Spoken as one instruction, because neither half is any use without the other.
    static func spoken(_ challenge: ConnectChallenge) -> String {
        guard let userCode = challenge.userCode else {
            return "Approve Argo in the \(challenge.provider.readableName) page that just opened."
                + " Argo is waiting."
        }
        return "Type the code \(userCode) at \(challenge.verificationURL.absoluteString)."
            + " Argo is waiting."
    }

    static let all = [copy, copied, stop, waiting]
        + AccountProvider.allCases.flatMap { provider in
            [ConnectChallenge.typed(provider), ConnectChallenge.redirected(provider)]
                .flatMap { [heading(for: $0), address(of: $0), spoken($0)] }
        }
}

private extension ConnectChallenge {
    /// The two shapes the card draws, for the copy sweep alone — every word on screen has to be
    /// reachable from one list, and half of these are behind a provider's own flow.
    static func typed(_ provider: AccountProvider) -> ConnectChallenge {
        ConnectChallenge(
            provider: provider, userCode: "ABCD-1234", verificationURL: ConnectFixture.deviceURL,
        )
    }

    static func redirected(_ provider: AccountProvider) -> ConnectChallenge {
        ConnectChallenge(provider: provider, verificationURL: ConnectFixture.deviceURL)
    }
}
