import ArgoEngine
import ArgoUI
import Foundation

/// The step between holding an identity and binding a port: asking the provider what this Account
/// could be pointed at, so the panel offers repositories rather than a field to spell one into.
///
/// It is on the coordinator and not on the row for the reason every other act here is: a row that
/// held its own pending choice would be drawing what it hoped had happened, and the grant flow —
/// which opens a picker nobody clicked — would have no way to reach it (#821).
extension AccountsCoordinator {
    /// Open the picker on an Account and read the provider. Re-entrant on purpose: `Try again` is
    /// this same call, so a failed listing and a first one cannot answer differently.
    func choose(port: AccountPort, account accountID: String) {
        listing?.cancel()
        clearNote()
        scopes = ConnectScopes(port: port, accountID: accountID, state: .loading)
        listing = Task {
            await refresh()
            let catalogue = await bindings.scopes(on: port, through: accountID)
            // The picker may have been closed, or re-opened somewhere else, while the provider was
            // being read. Landing an answer on whatever is open now would put one port's
            // repositories under another's name.
            guard scopes?.port == port, scopes?.accountID == accountID else { return }
            scopes = ConnectScopes(port: port, accountID: accountID, state: .init(catalogue))
            await refresh()
        }
    }

    /// Close the picker, binding nothing. The read in flight goes with it — its answer has nowhere
    /// left to land.
    func cancelChoice() async {
        closePicker()
        await refresh()
    }

    func closePicker() {
        listing?.cancel()
        listing = nil
        scopes = nil
    }
}
