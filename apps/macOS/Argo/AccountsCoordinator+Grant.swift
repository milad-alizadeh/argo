import AppKit
import ArgoEngine
import ArgoUI
import Foundation

/// Authorizing one more identity, from the panel's side: ask the provider, show what the user has
/// to finish, wait. Two halves rather than one blocking call, so the card is on screen before
/// anything waits on it.
///
/// One path for both providers. Which flow a provider takes is `ProviderAuthorization`'s, where a
/// test can reach it — this half only draws what came back and adopts what it produced.
extension AccountsCoordinator {
    /// Repeatable by construction — a personal and a work GitHub are two Accounts, and the second
    /// is added the same way as the first (#414).
    func connect(_ provider: AccountProvider, for port: AccountPort) {
        cancelWait()
        // The picker that was open belonged to whatever was chosen before this. A new identity
        // opens its own, once there is one.
        closePicker()
        // The last refusal goes with it. A note left standing under a fresh card would be read as
        // this attempt having failed before it began.
        clearNote()
        grant = Task { await authorize(provider, for: port) }
    }

    /// Stop waiting. The grant stays good at the provider and the Account is simply not recorded:
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
        do {
            let asked = try await authorization.begin(provider)
            let shown = asked.challenge
            challenge = ConnectChallenge(shown)
            await refresh()
            if shown.opensItself {
                NSWorkspace.shared.open(shown.url)
            }
            let account = try await authorization.complete(asked)
            await adopt(account, for: port)
        } catch {
            await report(error, from: provider)
        }
    }

    /// The identity is held, and the row that asked for it says so on the next rebuild — and then
    /// opens straight onto the scopes it can now see. Without this the card simply vanishes and
    /// the panel reads exactly as it did before (#821).
    private func adopt(_ account: AccountRecord, for port: AccountPort) async {
        challenge = nil
        // The one act, taken. Every Binding naming this Account reads again, across Projects and
        // both ports — a refusal is recorded once against the identity, so obtaining a grant for
        // it clears one record and not one per Binding (#569).
        await health.reconnected(account.id)
        choose(port: port, account: account.id)
    }

    /// A cancelled wait is the user pressing Stop. It is not a failure to report — but the panel
    /// is still rebuilt, or the card the cancel took down would stay drawn.
    private func report(_ error: Error, from provider: AccountProvider) async {
        challenge = nil
        guard !(error is CancellationError) else { return await refresh() }
        await report(ConnectNote(grant: error, provider: provider))
    }
}
