import Foundation

/// The agent PTYs Argo owns, held for the whole life of the process that spawned them.
///
/// Two things this registry must never do: stop reading a PTY (an unread PTY back-pressures until
/// the child stalls), and kill one when a viewer goes away (the agent outlives the pane watching
/// it). Both are why the drain is subscribed here, once, at adoption.
@MainActor
public final class AgentTerminals {
    /// How many bytes of an agent's output are kept for a viewer that attaches after the fact. A
    /// terminal opens long after the spawn, so with no replay the pane would open blank on a
    /// session mid-flight. Bounded because this is a live tail: the transcript on disk is the
    /// durable record.
    public static let replayLimit = 200_000

    private final class Adopted {
        let process: AgentProcess
        var replay: [UInt8] = []
        var viewers: [Int: ([UInt8]) -> Void] = [:]

        init(process: AgentProcess) {
            self.process = process
        }
    }

    private var agents: [SessionOwnership.ClaimID: Adopted] = [:]
    private var nextViewer = 0

    public init() {}

    /// Take ownership of a freshly spawned agent's PTY, keyed by the claim that owns it.
    public func adopt(_ id: SessionOwnership.ClaimID, process: AgentProcess) {
        agents[id] = Adopted(process: process)
    }

    /// Fold one chunk of the agent's output into its replay and hand it to whoever is watching.
    /// Called from the host's data callback, which runs whether or not anything is attached.
    public func received(_ chunk: [UInt8], from id: SessionOwnership.ClaimID) {
        guard let entry = agents[id] else { return }
        entry.replay = Array((entry.replay + chunk).suffix(Self.replayLimit))
        for viewer in entry.viewers.values {
            viewer(chunk)
        }
    }

    /// The PTY exited: there is nothing left to steer.
    public func drop(_ id: SessionOwnership.ClaimID) {
        agents.removeValue(forKey: id)
    }

    /// Watch and steer one agent, or `nil` when no live PTY answers to that claim.
    public func attach(
        to id: SessionOwnership.ClaimID,
        onData: @escaping ([UInt8]) -> Void,
    )
        -> AttachedTerminal? {
        guard let entry = agents[id] else { return nil }
        nextViewer += 1
        let viewer = nextViewer
        entry.viewers[viewer] = onData
        if !entry.replay.isEmpty {
            onData(entry.replay)
        }
        return AttachedTerminal(
            process: entry.process,
            detach: { [weak self] in self?.agents[id]?.viewers.removeValue(forKey: viewer) },
        )
    }

    /// End every PTY this registry holds. What window close and app quit call, so no agent Argo
    /// started outlives the Argo that started it.
    public func terminateAll() {
        // Snapshotted and cleared BEFORE anything is ended: a host reports the exit it was just
        // asked for, and the owner answers that by dropping the very table this would be walking.
        let ending = Array(agents.values)
        agents = [:]
        for entry in ending {
            entry.process.terminate()
        }
    }
}
