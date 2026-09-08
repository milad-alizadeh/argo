import ArgoEngine
import Foundation

/// The intents the Connect panel raises. Every one is performed by the app layer — a folder
/// picker, a device flow, a registry write — so the panel decides WHAT is being asked for and
/// nothing about how it happens.
public struct ConnectPanelActions {
    /// Choose the Project's folder. The act that makes a Project, so it is the app's to run.
    public let chooseFolder: () -> Void
    /// Authorize one more identity with a provider, for the port that asked. Repeatable by
    /// construction: a machine may hold a personal and a work GitHub. The port travels with it so
    /// the identity, once held, opens ITS picker (#821).
    public let connectAccount: (AccountProvider, AccountPort) -> Void
    /// Read this port through this Account, and ask the provider what it could be pointed at. The
    /// step before `bindPort`, and the one that opens the scope picker.
    public let chooseAccount: (AccountPort, String) -> Void
    /// Close the scope picker without binding anything.
    public let cancelChoice: () -> Void
    /// Read one port through one Account, at one scope — which is to say, a `ProjectBinding`.
    public let bindPort: (ProjectBinding) -> Void
    /// Give one port back to unbound, leaving the other where it is.
    public let unbindPort: (AccountPort) -> Void
    /// Stop waiting on a device flow. The code stays good at the provider; Argo simply stops
    /// asking, which is what the user pressing Cancel means.
    public let stopWaiting: () -> Void
    /// Close the panel: `Create project` on the way in, `Done` on the way back.
    public let finish: () -> Void

    /// For previews and specimens, where nothing is wired and nothing should be.
    @MainActor public static let inert = ConnectPanelActions(
        chooseFolder: {},
        connectAccount: { _, _ in },
        chooseAccount: { _, _ in },
        cancelChoice: {},
        bindPort: { _ in },
        unbindPort: { _ in },
        stopWaiting: {},
        finish: {},
    )

    public init(
        chooseFolder: @escaping () -> Void,
        connectAccount: @escaping (AccountProvider, AccountPort) -> Void,
        chooseAccount: @escaping (AccountPort, String) -> Void,
        cancelChoice: @escaping () -> Void,
        bindPort: @escaping (ProjectBinding) -> Void,
        unbindPort: @escaping (AccountPort) -> Void,
        stopWaiting: @escaping () -> Void,
        finish: @escaping () -> Void,
    ) {
        self.chooseFolder = chooseFolder
        self.connectAccount = connectAccount
        self.chooseAccount = chooseAccount
        self.cancelChoice = cancelChoice
        self.bindPort = bindPort
        self.unbindPort = unbindPort
        self.stopWaiting = stopWaiting
        self.finish = finish
    }
}
