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
        switch challenge.kind {
        case .typed: return "Type this code at \(name)"
        case .redirect: return "Approve Argo in \(name)"
        }
    }

    /// The address the link reads as. A redirect flow's URL is long and carries the request's own
    /// secrets, so the link is named rather than spelled out — a device flow's is short and IS the
    /// instruction.
    static func address(of challenge: ConnectChallenge) -> String {
        switch challenge.kind {
        case .typed: challenge.verificationURL.absoluteString
        case .redirect: "Open \(challenge.provider.readableName) again"
        }
    }

    /// Spoken as one instruction, because neither half is any use without the other.
    static func spoken(_ challenge: ConnectChallenge) -> String {
        switch challenge.kind {
        case let .typed(code):
            "Type the code \(code) at \(challenge.verificationURL.absoluteString)."
                + " Argo is waiting."
        case .redirect:
            "Approve Argo in the \(challenge.provider.readableName) page that just opened."
                + " Argo is waiting."
        }
    }

    static let all = [copy, copied, stop, waiting]
        + AccountProvider.allCases.flatMap { provider in
            [ConnectFixture.typed(provider), ConnectFixture.redirected(provider)]
                .flatMap { [heading(for: $0), address(of: $0), spoken($0)] }
        }
}
