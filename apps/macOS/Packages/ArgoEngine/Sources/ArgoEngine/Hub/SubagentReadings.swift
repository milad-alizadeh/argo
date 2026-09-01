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

    /// A fresh read of one file starts here, and drops whatever the last read of it left. A tail
    /// re-reads from the first byte, so a transcript that aged out of the working set and came back
    /// appended its Subagents' rows a second time.
    func beginReading(of agentID: String, from path: String) {
        filesByAgent[agentID, default: []].insert(path)
        byFile[path] = nil
    }

    /// One batch, appended. A read carrying nothing publishes nothing: a file that exists and has
    /// said nothing yet is a Subagent with no reading rather than one with an empty reading.
    func apply(_ read: [TranscriptEvent], from path: String) {
        guard !read.isEmpty else { return }
        byFile[path, default: []] += read
    }

    /// Forget these readings — what a transcript leaving the set for good takes with it, the way
    /// its row goes. Each Agent is named WITH the file it was read from, so the half of a moved
    /// transcript that goes away drops its own bytes and leaves the live half's standing.
    func forget(claims: [String: String]) {
        for (agentID, path) in claims {
            byFile[path] = nil
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
    }
}
