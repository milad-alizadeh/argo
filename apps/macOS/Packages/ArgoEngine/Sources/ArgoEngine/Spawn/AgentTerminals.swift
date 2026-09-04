import Foundation

/// The agent PTYs Argo owns, held for the whole life of the process that spawned them.
///
/// Two things this registry must never do: stop reading a PTY (an unread PTY back-pressures until
/// the child stalls), and kill one when a viewer goes away (the agent outlives the pane watching
/// it). Both are why the drain is subscribed here, once, at adoption.
@MainActor
final class AgentTerminals {
    /// How many bytes of an agent's output are kept for a viewer that attaches after the fact. A
    /// terminal opens long after the spawn, so with no replay the pane would open blank on a
    /// session mid-flight. Bounded because this is a live tail: the transcript on disk is the
    /// durable record.
    static let replayLimit = 200_000

    private final class Adopted {
        let process: AgentProcess
        var replay: [UInt8] = []
        var viewers: [Int: ([UInt8]) -> Void] = [:]

        init(process: AgentProcess) {
            self.process = process
        }
    }

    private var agents: [SessionOwnership.ClaimID: Adopted] = [:]
    /// Whose input a multi-write walk is holding. Kept here because this is what owns the writes:
    /// a rung is walked one keystroke at a time (#653), and a second walk starting mid-way would
    /// count its distance from a stance the first has already left and interleave its keystrokes
    /// with it.
    private var walking: Set<SessionOwnership.ClaimID> = []
    /// The Turn still being typed at each agent, so the next one waits for it: a second paste
    /// landing between a Turn's paste and its Return would be submitted BY that Return, the two
    /// messages arriving as one Turn.
    ///
    /// Only Turns queue here. A single-burst `write` goes out when it is asked for, as it always
    /// has — an `ESC` or a back-tab held back behind a Turn would be paced by whatever the Turn is
    /// waiting on rather than by its own caller, and a mode walk whose steps lost their spacing is
    /// #653 again.
    ///
    /// So a Turn's pause is closed against other TURNS and against nothing else, and what can land
    /// in it lands harmlessly: a back-tab cycles the rung and leaves the composer holding the
    /// Turn, and an `ESC` clears the composer, after which the Return submits an empty field. That
    /// second one drops the Turn rather than stopping it once it runs — which is what Stop was
    /// pressed for either way.
    private var typing: [SessionOwnership.ClaimID: Typing] = [:]
    private var nextTyping = 0
    private var nextViewer = 0

    /// One queued Turn, and the number that says whether the queue's tail is still THIS one by the
    /// time it finishes — the tail is cleared only by the link that is still it, so a Turn that
    /// arrived behind this one is not dropped out of the chain it is waiting on.
    private struct Typing {
        let number: Int
        let task: Task<Void, Never>
    }

    init() {}

    /// Take ownership of a freshly spawned agent's PTY, keyed by the claim that owns it.
    func adopt(_ id: SessionOwnership.ClaimID, process: AgentProcess) {
        agents[id] = Adopted(process: process)
    }

    /// Fold one chunk of the agent's output into its replay and hand it to whoever is watching.
    /// Called from the host's data callback, which runs whether or not anything is attached.
    func received(_ chunk: [UInt8], from id: SessionOwnership.ClaimID) {
        guard let entry = agents[id] else { return }
        // Appended and trimmed from the front, rather than rebuilt: this runs once per chunk on a
        // busy PTY, and `suffix` over a 200 KB buffer would copy the whole thing every time.
        entry.replay += chunk
        if entry.replay.count > Self.replayLimit {
            entry.replay.removeFirst(entry.replay.count - Self.replayLimit)
        }
        for viewer in entry.viewers.values {
            viewer(chunk)
        }
    }

    /// Whether the process behind one claim is still there — asked of the child itself, never of
    /// the process table (`AgentProcess.isRunning`). `false` where no PTY answers to that claim at
    /// all, which is the same answer for the same reason: nothing of it is left.
    func isRunning(_ id: SessionOwnership.ClaimID) -> Bool {
        agents[id]?.process.isRunning ?? false
    }

    /// The PTY exited: there is nothing left to steer.
    func drop(_ id: SessionOwnership.ClaimID) {
        agents.removeValue(forKey: id)
        typing.removeValue(forKey: id)?.task.cancel()
    }

    /// Type at one agent's prompt without becoming a viewer of it — what Argo steering a Session it
    /// is not drawing means. `false` where no live PTY answers to that claim, which the caller has
    /// to hear: a keystroke sent nowhere is exactly what "nothing happened" looks like.
    @discardableResult
    func write(_ text: String, to id: SessionOwnership.ClaimID) -> Bool {
        guard let entry = agents[id] else { return false }
        entry.process.write(text)
        return true
    }

    /// Type the two halves of one Turn, with the pause between them that makes them two reads
    /// rather than one (`PacedKeystrokes`).
    ///
    /// The paste goes when it is asked for, exactly as the whole Turn used to, and only the Return
    /// waits. Deferring the paste as well would let a keystroke asked for AFTERWARDS overtake it —
    /// a Stop pressed on a Turn arriving before the Turn it was pressed on.
    ///
    /// A Turn typed while another is still being typed is the one thing that does wait, and it
    /// waits whole: its paste landing in the pause would be submitted by the FIRST Turn's Return,
    /// the two messages arriving as one Turn.
    ///
    /// `true` says a live PTY answered when this was asked for — not that the Return landed. A PTY
    /// that goes away inside the pause takes it, exactly as it would have taken the whole Turn a
    /// moment earlier.
    @discardableResult
    func write(_ paced: PacedKeystrokes, to id: SessionOwnership.ClaimID) -> Bool {
        guard let entry = agents[id] else { return false }
        let ahead = typing[id]?.task
        if ahead == nil {
            entry.process.write(paced.first)
        }
        nextTyping += 1
        let number = nextTyping
        typing[id] = Typing(number: number, task: Task { [weak self] in
            // Cleared on every way out, and only by the link that is still the tail: a Turn that
            // arrived behind this one is left holding the chain it is waiting on.
            defer {
                if self?.typing[id]?.number == number {
                    self?.typing[id] = nil
                }
            }
            // Checked after each wait rather than relying on the PTY having been dropped too.
            // Awaiting a `Task<Void, Never>` is not cancellation-aware, so a cancelled link
            // resumes like any other and would type into whatever answered next.
            if let ahead {
                await ahead.value
                guard !Task.isCancelled else { return }
                self?.agents[id]?.process.write(paced.first)
            }
            try? await Task.sleep(for: paced.gap)
            guard !Task.isCancelled else { return }
            self?.agents[id]?.process.write(paced.second)
        })
        return true
    }

    /// Take this agent's input for a walk, and `false` where a walk already holds it.
    func beginWalk(on id: SessionOwnership.ClaimID) -> Bool {
        walking.insert(id).inserted
    }

    func endWalk(on id: SessionOwnership.ClaimID) {
        walking.remove(id)
    }

    /// Watch and steer one agent, or `nil` when no live PTY answers to that claim.
    func attach(
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
    func terminateAll() {
        // Snapshotted and cleared BEFORE anything is ended: a host reports the exit it was just
        // asked for, and the owner answers that by dropping the very table this would be walking.
        let ending = Array(agents.values)
        agents = [:]
        for turn in typing.values {
            turn.task.cancel()
        }
        typing = [:]
        for entry in ending {
            entry.process.terminate()
        }
    }
}
