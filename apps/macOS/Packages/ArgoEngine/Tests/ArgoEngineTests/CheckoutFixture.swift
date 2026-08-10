@testable import ArgoEngine
import Foundation

/// The other adapter of the checkout port: the repositories a machine would have, without the
/// machine. Anything absent from the table is a folder in no repository, and the table is mutable
/// because what a refresh exists for is the answer changing.
actor CheckoutFixture {
    private var byPath: [String: CheckoutProjection] = [:]

    /// One repository: its root, and the folders inside it git would resolve to that root.
    func repository(
        at rootURL: URL,
        head: CheckoutProjection.Head = .unavailable,
        folders: [URL] = [],
    ) {
        for url in [rootURL] + folders {
            byPath[url.path] = CheckoutProjection(repositoryURL: rootURL, head: head)
        }
    }

    /// A folder git can no longer resolve — removed since it was last read.
    func forget(_ url: URL) {
        byPath.removeValue(forKey: url.path)
    }

    nonisolated var read: CheckoutRead {
        { [self] url in await projection(at: url) }
    }

    private func projection(at url: URL) -> CheckoutProjection {
        byPath[url.path] ?? CheckoutProjection(repositoryURL: url, head: .unavailable)
    }
}

/// A Hub reading its checkout through the fixture adapter rather than through `git`, which is what
/// keeps a test of the join from spawning a subprocess to be told what it already supplied.
///
/// An empty fixture by default: no repository under any folder, and a read that suspends the way
/// every real one does, so a test about what `connect` looks like mid-flight has a window to see.
///
/// Liveness reads nothing by default for the same reason the checkout does: a suite that asked the
/// machine's own process table would answer differently depending on what its author had running.
@MainActor
func testHub(
    projectURL: URL,
    checkout: @escaping CheckoutRead = CheckoutFixture().read,
    discovery: SessionDiscovery = SessionDiscovery(),
    liveness: @escaping LivenessRead = noLiveProcesses,
)
    -> Hub {
    Hub(
        projectURL: projectURL,
        // No git read of any Session's folder: a suite that shelled out per poll would be
        // asserting what this machine's checkouts happen to be. `HubWorkspaceTests` supplies its
        // own read where the answer is the point.
        engine: Engine(
            readCheckout: checkout,
            readWorkspace: noWorkspaceRead,
            readLiveness: liveness,
        ),
        discovery: discovery,
    )
}

/// A machine with no agent running on it anywhere.
let noLiveProcesses: LivenessRead = { [] }

/// A machine where git answers for no folder at all.
let noWorkspaceRead: WorkspaceRead = { _ in nil }

/// A machine running an agent in each of these folders.
func liveProcesses(in cwds: String...) -> LivenessRead {
    let live = Set(cwds)
    return { live }
}
