import Foundation

/// One Subagent's own transcript file, and the Subagent it belongs to.
public struct SubagentTranscript: Sendable, Equatable {
    /// The CLI's own id for the Subagent. The join key, and the only one: the delegating call's
    /// result reports this same string, so it is what ties a file to the call that started it.
    public let agentID: String
    public let url: URL
}

/// The shape of one Session's Subagent tree as the last walk left it: every directory in it, under
/// the date that directory carried then.
///
/// The key the re-walk is skipped on. A file cannot appear in a directory without that directory's
/// own modification date moving — adding a name to a directory IS a write to the directory — so a
/// tree whose dates all still match cannot have gained a Subagent file. That holds at every depth,
/// which is why every directory is stamped and not only the root: an Agent a workflow ran lands in
/// a directory of its own, and a second one lands in that directory without touching the root
/// above it. A directory that has since gone counts as moved.
///
/// The dates are the file system's own, at its own resolution, so two writes a second apart and
/// two a microsecond apart are both seen. `tool-results/` is absent by construction: the walk never
/// enters it, so nothing written there is a change this stamp can notice — which is the point,
/// since the walk keeps nothing from in there either.
struct SubagentTreeStamp: Sendable, Equatable {
    var directoryDates: [String: Date]

    /// Whether the tree still looks exactly as this stamp recorded it.
    ///
    /// An EMPTY stamp is never still true. That is the tree whose `subagents/` directory did not
    /// exist at all, and the one thing a stamp of nothing cannot tell you is whether it has since
    /// been created.
    fileprivate var isStillTrue: Bool {
        guard !directoryDates.isEmpty else { return false }
        return directoryDates.allSatisfy { path, stamped in
            let values = try? URL(fileURLWithPath: path)
                .resourceValues(forKeys: [.contentModificationDateKey])
            return values?.contentModificationDate == stamped
        }
    }
}

/// What one walk of a Session's Subagent tree found, and the stamp that says the next one can be
/// skipped.
struct SubagentWalk: Sendable, Equatable {
    let transcripts: [SubagentTranscript]
    let stamp: SubagentTreeStamp
}

/// One tree to walk: whose transcript it sits beside, and what the last walk of it left.
///
/// A sweep asks for the whole working set at once rather than a tree at a time, so the walk costs
/// ONE hop off the main actor and one back rather than a pair per Session. That leaves the sweep's
/// main-actor half a single block, as it was when the walk was made inline — and one window in
/// which a stop can overtake it rather than one per Session (`SubagentTails.refresh`).
struct SubagentWalkRequest: Sendable {
    let transcriptID: String
    let parentURL: URL
    /// Filled in by `SubagentTails`, which is the only holder of what the last walk left. Absent
    /// is a tree to walk from scratch.
    var stamp: SubagentTreeStamp?

    init(transcriptID: String, parentURL: URL) {
        self.transcriptID = transcriptID
        self.parentURL = parentURL
    }
}

/// The Subagent transcripts beside one Session's own record.
///
/// Claude Code writes each Subagent to a file of its own under a directory named for the parent,
/// never inline in the parent's record — so a fan-out is N files that appear while the parent runs
/// and go on growing after it falls quiet. The walk RECURSES, because an Agent a workflow ran sits
/// one directory further down again; the roster's own sweep takes exactly one level for the
/// opposite reason, so that these are never mistaken for Sessions.
///
/// The walk is asked on every sweep, about trees that almost never move — a sweep is a wake-up from
/// the record ROOT, so a CLI writing under any other Project wakes this one. It is bounded twice
/// over for that: `tool-results/` is never entered, and a tree whose `SubagentTreeStamp` still
/// holds is not entered at all (#1498).
enum SubagentTranscripts {
    /// Ordered by `agentID`, which is arbitrary but stable — a directory walk has no order of its
    /// own, and the order the work was handed over in is a fact about the parent's calls rather
    /// than about the files.
    ///
    /// `nil` where `stamp` still holds: the tree has not moved, so the answer is the one the caller
    /// already has rather than an empty one.
    static func beside(
        _ parentURL: URL,
        unchangedSince stamp: SubagentTreeStamp?,
    )
        -> SubagentWalk? {
        guard stamp?.isStillTrue != true else { return nil }
        let rootURL = parentURL.deletingPathExtension()
            .appending(path: subagentsDirectory, directoryHint: .isDirectory)
        return walk(rootURL)
    }

    private static func walk(_ rootURL: URL) -> SubagentWalk {
        var transcripts: [SubagentTranscript] = []
        var directoryDates: [String: Date] = [:]
        // BEFORE the enumerator, which reads the root's contents at its first step. A date taken
        // after the walk would cover a file created into the root DURING it: not returned below,
        // yet stamped as seen, so no later sweep would look again and the fan-out would be lost
        // until some other directory in the tree happened to move.
        //
        // The rule the whole stamp rests on: a directory's recorded date must be read no later
        // than its contents were. Older is safe — it mismatches the truth and costs one re-walk.
        // Newer is the bug. Each directory below is stamped as it is yielded, which is at or
        // before the enumerator descends into it, so they satisfy the same rule.
        let rootDate = modificationDate(of: rootURL)
        if let entries = FileManager.default.enumerator(
            at: rootURL,
            includingPropertiesForKeys: walkedKeys,
        ) {
            for case let url as URL in entries {
                guard let date = directoryDate(of: url) else {
                    if let found = transcript(at: url) {
                        transcripts.append(found)
                    }
                    continue
                }
                // Enumerated and then discarded before, and it is most of the file count: the host
                // writes one file per tool result under here and this walk keeps none of them.
                guard url.lastPathComponent != toolResultsDirectory else {
                    entries.skipDescendants()
                    continue
                }
                directoryDates[url.path] = date
            }
        }
        return SubagentWalk(
            transcripts: transcripts.sorted { $0.agentID < $1.agentID },
            stamp: stamp(of: rootURL, at: rootDate, under: directoryDates),
        )
    }

    /// The root's own date, and the tree's under it. The root is carried by hand because an
    /// enumerator yields what is UNDER the directory it was given and never that directory — and a
    /// fan-out's FIRST file moves the root and nothing else.
    ///
    /// A root with no date is a `subagents/` directory that is not there. That stamps as nothing at
    /// all, which is the one stamp that is never still true: a stamp of an absent tree cannot say
    /// whether the tree has since been created, and a Session that delegated nothing must still
    /// notice its first delegation.
    private static func stamp(
        of rootURL: URL,
        at rootDate: Date?,
        under dates: [String: Date],
    )
        -> SubagentTreeStamp {
        guard let rootDate else { return SubagentTreeStamp(directoryDates: [:]) }
        var directoryDates = dates
        directoryDates[rootURL.path] = rootDate
        return SubagentTreeStamp(directoryDates: directoryDates)
    }

    private static func modificationDate(of url: URL) -> Date? {
        try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
    }

    /// A directory's own modification date, or `nil` for anything that is not a directory. One stat
    /// answers both questions, which is why they are asked together: the walk visits every entry in
    /// the tree and a second stat each would double what it costs.
    private static func directoryDate(of url: URL) -> Date? {
        guard let values = try? url.resourceValues(forKeys: Set(walkedKeys)),
              values.isDirectory == true else { return nil }
        return values.contentModificationDate
    }

    /// A Subagent's transcript, or `nil` for any other file in that tree — a file the host did not
    /// name for an Agent has no id to key it by.
    private static func transcript(at url: URL) -> SubagentTranscript? {
        guard url.pathExtension == "jsonl" else { return nil }
        let name = url.transcriptStem
        guard name.hasPrefix(agentFilePrefix) else { return nil }
        return SubagentTranscript(agentID: String(name.dropFirst(agentFilePrefix.count)), url: url)
    }
}

/// Asked for on every entry the walk visits, so that one stat answers both what the entry is and,
/// for a directory, the date the stamp is made of.
private let walkedKeys: [URLResourceKey] = [.isDirectoryKey, .contentModificationDateKey]

private let subagentsDirectory = "subagents"
private let toolResultsDirectory = "tool-results"
private let agentFilePrefix = "agent-"
