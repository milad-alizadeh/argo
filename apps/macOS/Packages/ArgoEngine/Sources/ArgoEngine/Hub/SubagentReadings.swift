import Foundation
import Observation

/// Each Subagent's own reading, published BESIDE the roster rather than inside it (#858).
///
/// A fan-out's files grow the whole time an agent works — three of them delegating wrote 89 batches
/// a minute on the machine this was measured on — and while those events lived in `HubJoin`, every
/// batch republished the join. Everything that draws a Session reads that one property, so bytes
/// only a Subagent lane can render invalidated the scene root and the whole cockpit projection with
/// it. Here they reach the surfaces that ask for a reading — the rail, and the feed while it is
/// scoped onto an Agent — and neither the roster nor the scene above it.
///
/// The granularity is that and no finer: this is one observed property, so a batch for one Agent
/// invalidates every reader that asked about any of them. The rail redrawing because another
/// Session's delegate wrote is a chip's worth of work; the scene root doing it was the ticket.
///
/// Held per FILE and answered per Agent, which is what lets the answer be honest where two files
/// carry one id — see `reading(of:)`.
@MainActor
@Observable
final class SubagentReadings {
    /// What each tailed file has said, keyed by its path.
    private var byFile: [String: [TranscriptEvent]] = [:]
    /// Which files are being read for each Agent. Normally one. Two while both halves of a
    /// transcript the CLI MOVED are tailed (#770): its Subagent files stay at the path it left, and
    /// both halves carry the same ids.
    private var filesByAgent: [String: Set<String>] = [:]
    /// When Argo last watched each file GROW (#1269). The evidence a delegation is live that the
    /// parent's own record does not hold: a parent that has delegated and is now waiting writes
    /// nothing, so its status reads `idle` while its children work.
    ///
    /// GROWTH and not "when Argo last read this", which are different claims. A tail re-reads its
    /// file from the first byte, so the backfill of a child that finished yesterday arrives now —
    /// dating that would draw every long-dead delegation live for ten minutes after the cockpit
    /// opened. Only the batches AFTER the backfill are writes Argo saw happen.
    private var grewAtMsByFile: [String: Int] = [:]
    /// What dates a batch. Injected so a suite can name the moment; every shipping caller wants the
    /// real one.
    private let clock: @Sendable () -> Int

    init(clock: @escaping @Sendable () -> Int = { Date().epochMs }) {
        self.clock = clock
    }

    /// One Subagent's reading, or nothing where Argo has not read its file. The two are different
    /// claims — no rows would say the Agent did nothing — and `FeedAgentReadings` is what turns the
    /// second into a chip that stays quiet rather than a control that empties the feed.
    ///
    /// Two files carrying one id answer NOTHING, which is the rule `HubRoster` used to enforce by
    /// refusing both: which of the two halves is live is the chain graph's answer, not this one's,
    /// and picking by whichever was tailed first would draw a frozen prefix as though it were the
    /// reading.
    ///
    /// The case it is for resolves: the CLI MOVES a transcript, the sweep drops the path that has
    /// gone, and the survivor answers from the bytes it was accumulating all along. Two files that
    /// both stay — a worktree COPIED rather than moved, so one Agent id is genuinely being written
    /// under two paths — answer nothing for as long as both are tailed, and the chip stays quiet.
    /// That is degrade-down and not a resolution: Argo cannot say which of two live files is the
    /// Agent, and a chip that opened one of them at random would be worse than a chip that waits.
    func reading(of agentID: String) -> [TranscriptEvent]? {
        guard let files = filesByAgent[agentID], files.count == 1, let path = files.first
        else { return nil }
        return byFile[path]
    }

    /// When Argo last watched this Agent's file grow, or nothing where it has not seen it grow at
    /// all. Answered under the SAME one-file rule the reading above is, and for the same reason: an
    /// Agent Argo cannot resolve to one file is an Agent it can say nothing about, and a growing
    /// half would otherwise date an id that names two.
    func lastGrewAtMs(of agentID: String) -> Int? {
        guard let files = filesByAgent[agentID], files.count == 1, let path = files.first
        else { return nil }
        return grewAtMsByFile[path]
    }

    /// A fresh read of one file starts here, and drops whatever the last read of it left. A tail
    /// re-reads from the first byte, so a transcript that aged out of the working set and came back
    /// appended its Subagents' rows a second time.
    func beginReading(of agentID: String, from path: String) {
        filesByAgent[agentID, default: []].insert(path)
        byFile[path] = nil
        grewAtMsByFile[path] = nil
    }

    /// One batch, appended. A read carrying nothing publishes nothing: a file that exists and has
    /// said nothing yet is a Subagent with no reading rather than one with an empty reading.
    ///
    /// Every batch but the FIRST dates the file, per the note on `grewAtMsByFile`: the first is
    /// what the file already held when the tail opened it, and the rest are Argo watching it grow.
    /// Which batch that is takes no table of its own — a file with bytes already in it has had its
    /// backfill, and `beginReading` is what empties it again.
    func apply(_ read: [TranscriptEvent], from path: String) {
        guard !read.isEmpty else { return }
        let isBackfill = byFile[path] == nil
        byFile[path, default: []] += read
        if !isBackfill {
            grewAtMsByFile[path] = clock()
        }
    }

    /// Forget these readings — what a transcript leaving the set for good takes with it, the way
    /// its row goes. Each Agent is named WITH the file it was read from, so the half of a moved
    /// transcript that goes away drops its own bytes and leaves the live half's standing.
    func forget(claims: [String: String]) {
        for (agentID, path) in claims {
            byFile[path] = nil
            grewAtMsByFile[path] = nil
            filesByAgent[agentID]?.remove(path)
            if filesByAgent[agentID]?.isEmpty == true {
                filesByAgent[agentID] = nil
            }
        }
    }

    /// Forget every reading. A Project nobody is pointed at has no Subagents, the same way it has
    /// no branches (`WorldReadings.stop`).
    func forgetAll() {
        byFile = [:]
        filesByAgent = [:]
        grewAtMsByFile = [:]
    }
}
