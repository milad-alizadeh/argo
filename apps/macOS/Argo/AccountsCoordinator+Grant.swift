import ArgoEngine
import ArgoUI
import Foundation

/// Authorizing one more identity, from the panel's side: ask for a code, show it, wait.
///
/// Two halves rather than one blocking call, because that is the shape `GitHubDeviceFlow` hands
/// back and the reason it does: the code is on screen before anything waits on it. A user cannot
/// finish a device flow they cannot read.
extension AccountsCoordinator {
    /// Repeatable by construction. Nothing here asks whether an Account with this provider already
    /// exists, because a personal and a work GitHub are two Accounts and the second is added the
    /// same way as the first (#414).
    func connect(_ provider: AccountProvider) {
        stopWaiting()
        grant = Task { await authorize(provider) }
    }

    /// Stop waiting. The code stays good at the provider and the Account is simply not recorded:
    /// Argo cannot un-grant something the user may already have approved, and saying it had would
    /// be a fabricated DIRECT.
    func stopWaiting() {
        grant?.cancel()
        grant = nil
        challenge = nil
    }

    private func authorize(_ provider: AccountProvider) async {
        switch provider {
        case .github: await authorizeGitHub()
        // Linear's grant is #371's. Unreachable from the panel, which offers only what this build
        // can run, and answered honestly rather than silently if it is ever reached another way.
        case .linear:
            await report(ConnectNote(
                what: "Argo cannot sign in to Linear yet.",
                why: "That connection is still being built.",
                fix: "Use a GitHub account for now.",
            ))
        }
    }

    private func authorizeGitHub() async {
        do {
            let asked = try await authorization.begin()
            challenge = ConnectChallenge(
                provider: .github,
                userCode: asked.userCode,
                verificationURL: asked.verificationURL,
            )
            await refresh()
            _ = try await authorization.complete(asked)
            challenge = nil
            await refresh()
        } catch let failure as GitHubDeviceFlowError {
            challenge = nil
            await report(ConnectNote(deviceFlow: failure, provider: .github))
        } catch {
            // A cancelled wait is the user pressing Stop, and it is not a failure to report.
            guard !(error is CancellationError) else { return }
            challenge = nil
            await report(ConnectNote(refusal: .unreadable(error.localizedDescription)))
        }
    }
}
