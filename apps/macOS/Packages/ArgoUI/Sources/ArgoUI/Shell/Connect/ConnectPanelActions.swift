import ArgoEngine
import Foundation

/// The intents the Connect panel raises. Every one is performed by the app layer — a folder
/// picker, a device flow, a registry write — so the panel decides WHAT is being asked for and
/// nothing about how it happens.
public struct ConnectPanelActions {
    /// Choose the Project's folder. The act that makes a Project, so it is the app's to run.
    public let chooseFolder: () -> Void
    /// Authorize one more identity with a provider. Repeatable by construction: a machine may hold
    /// a personal and a work GitHub, and neither replaces the other.
    public let connectAccount: (AccountProvider) -> Void
    /// Read one port through one Account, at one scope — which is to say, a `ProjectBinding`. The
    /// engine's own value rather than its three fields loose, because an act that could set them
    /// separately could leave two of them pointing somewhere the third does not, and because the
    /// app would only reassemble them one hop later anyway.
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
        connectAccount: { _ in },
        bindPort: { _ in },
        unbindPort: { _ in },
        stopWaiting: {},
        finish: {},
    )

    public init(
        chooseFolder: @escaping () -> Void,
        connectAccount: @escaping (AccountProvider) -> Void,
        bindPort: @escaping (ProjectBinding) -> Void,
        unbindPort: @escaping (AccountPort) -> Void,
        stopWaiting: @escaping () -> Void,
        finish: @escaping () -> Void,
    ) {
        self.chooseFolder = chooseFolder
        self.connectAccount = connectAccount
        self.bindPort = bindPort
        self.unbindPort = unbindPort
        self.stopWaiting = stopWaiting
        self.finish = finish
    }
}
