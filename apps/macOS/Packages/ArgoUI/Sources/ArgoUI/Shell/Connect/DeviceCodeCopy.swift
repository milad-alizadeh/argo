import ArgoEngine

/// What the device-code card says, as values. Outside the view for the reason `WelcomeCopy` is:
/// the copy rules are claims about every word on screen, and a `View` is `@MainActor` while the
/// suite that sweeps them is not.
enum DeviceCodeCopy {
    static let copy = "Copy code"
    static let copied = "Copied"
    static let stop = "Stop waiting"
    static let waiting = "Argo is waiting for you to finish in the browser."

    /// Named for the provider, because the user is being sent to that provider's own screen and
    /// "the provider" is not what it is called there.
    static func heading(for provider: AccountProvider) -> String {
        "Type this code at \(provider.readableName)"
    }

    static let all = [copy, copied, stop, waiting] + AccountProvider.allCases.map(heading(for:))
}
