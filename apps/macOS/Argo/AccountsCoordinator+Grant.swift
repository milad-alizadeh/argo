import ArgoEngine
import ArgoUI
import Foundation

/// Authorizing one more identity, from the panel's side: ask for a code, show it, wait. Two halves
/// rather than one blocking call, so the code is on screen before anything waits on it.
extension AccountsCoordinator {
    /// Repeatable by construction — a personal and a work GitHub are two Accounts, and the second
    /// is added the same way as the first (#414).
    func connect(_ provider: AccountProvider, for port: AccountPort) {
        cancelWait()
        // The picker that was open belonged to whatever was chosen before this. A new identity
        // opens its own, once there is one.
        closePicker()
        // The last refusal goes with it. A note left standing under a fresh device code would be
        // read as this attempt having failed before it began.
        clearNote()
        grant = Task { await authorize(provider, for: port) }
    }

    /// Stop waiting. The code stays good at the provider and the Account is simply not recorded:
    /// Argo cannot un-grant something the user may already have approved, and saying it had would
    /// be a fabricated DIRECT. The rebuild is required — without it the dismissed card stays drawn.
    func stopWaiting() async {
        cancelWait()
        await refresh()
    }

    /// The cancel without the rebuild, for the callers that rebuild straight afterwards anyway.
    func cancelWait() {
        grant?.cancel()
        grant = nil
        challenge = nil
    }

    private func authorize(_ provider: AccountProvider, for port: AccountPort) async {
        switch provider {
        case .github: await authorizeGitHub(for: port)
        // Linear's grant is #371's. Unreachable from the panel, which offers only what this build
        // can run, and answered honestly rather than silently if it is ever reached another way.
        case .linear: await report(.notYetAuthorizable(.linear))
        }
    }

    private func authorizeGitHub(for port: AccountPort) async {
        do {
            let asked = try await authorization.begin()
            challenge = ConnectChallenge(
                provider: .github,
                userCode: asked.userCode,
                verificationURL: asked.verificationURL,
            )
            await refresh()
            let account = try await authorization.complete(asked)
            challenge = nil
            // The one act, taken. Every Binding naming this Account reads again, across Projects
            // and both ports — a refusal is recorded once against the identity, so obtaining a
            // grant for it clears one record and not one per Binding (#569).
            await health.reconnected(account.id)
            // The identity is held, and the row that asked for it says so on the next rebuild —
            // and then opens straight onto the repositories it can now see. Without this the card
            // simply vanishes and the panel reads exactly as it did before (#821).
            choose(port: port, account: account.id)
        } catch let failure as GitHubDeviceFlowError {
            challenge = nil
            await report(ConnectNote(deviceFlow: failure, provider: .github))
        } catch {
            challenge = nil
            // A cancelled wait is the user pressing Stop. It is not a failure to report — but the
            // panel is still rebuilt, or the card the cancel took down would stay drawn.
            guard !(error is CancellationError) else { return await refresh() }
            await report(ConnectNote(refusal: .unreadable(error.localizedDescription)))
        }
    }
}
