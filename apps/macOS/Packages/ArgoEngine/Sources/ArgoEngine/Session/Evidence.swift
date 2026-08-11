// What a Tool Call PRODUCED, kinded (CONTEXT.md L3, "Result"). The TIER belongs to the payload and
// not to the call: the same read can yield the agent's own bytes or a weaker re-read from disk.

/// Which side of the change one printed line of a hunk sits on.
public enum DiffLineSide: String, Sendable, Equatable {
    case add
    case del
    case context
}

/// One printed line, with its `+`/`-`/space marker taken OFF: the SIDE carries that, so a renderer
/// decides once how a side is shown and no consumer strips a character back off the text.
public struct DiffLine: Sendable, Equatable {
    public let side: DiffLineSide
    public let text: String

    public init(side: DiffLineSide, text: String) {
        self.side = side
        self.text = text
    }
}

/// One contiguous run of changed lines with its surrounding context. The line numbers are the
/// host's own: they are what lets a bounded diff say WHERE in the file the hunk it shows sits.
public struct DiffHunk: Sendable, Equatable {
    public let oldStart: Int
    public let newStart: Int
    public let lines: [DiffLine]

    public init(oldStart: Int, newStart: Int, lines: [DiffLine]) {
        self.oldStart = oldStart
        self.newStart = newStart
        self.lines = lines
    }
}

/// What a mutation did to the file as a whole. Read from the change itself rather than from the
/// tool's name: `Write` both creates and updates, and no CLI has a delete tool at all, so the name
/// cannot tell these apart and the patch can.
public enum FileChange: String, Sendable, Equatable {
    case create
    case modify
    case delete
    /// The file went somewhere else. Read ONLY from a host that says so in its own word — a patch
    /// describes one path and cannot see the other end of a move, so nothing here infers one.
    case move
}

/// What a mutating call changed, as the record reported it. Point-in-time: what that ONE edit
/// changed when it was made, never re-read from disk and never updated by a later edit.
///
/// Zero hunks is the honest reading of a binary or unreadable patch — a renderer says "no diff
/// available" rather than drawing an empty block, and never invents lines to fill it.
public struct DiffEvidence: Sendable, Equatable {
    public let tier: Tier
    public let change: FileChange
    /// Where a moved file went, in the host's own characters. `nil` for every other change, and for
    /// a move whose destination the host did not name.
    public let destination: String?
    public let added: Int
    public let removed: Int
    public let hunks: [DiffHunk]

    public init(
        tier: Tier,
        change: FileChange,
        destination: String?,
        added: Int,
        removed: Int,
        hunks: [DiffHunk],
    ) {
        self.tier = tier
        self.change = change
        self.destination = destination
        self.added = added
        self.removed = removed
        self.hunks = hunks
    }
}

/// What a call PRINTED, verbatim.
public struct OutputEvidence: Sendable, Equatable {
    public let tier: Tier
    public let text: String

    public init(tier: Tier, text: String) {
        self.tier = tier
        self.text = text
    }
}

/// What a call SHOWED — the bytes the agent actually looked at, not whatever is at that path now.
///
/// The tier is the whole point of the type rather than a decoration on it. `direct` is the
/// transcript's OWN embedded block, which a later edit to the file cannot invalidate. `derived` is
/// a re-read of the path now: the same filename, which after three renders in one turn is very
/// often not the same picture.
public struct MediaEvidence: Sendable, Equatable {
    public let tier: Tier
    /// The image's own type as the record declared it, or as its extension implies for a disk read.
    /// What a row names when it has no pixels to show.
    public let mediaType: String
    /// The image, base64, exactly as it was read. `nil` where there are none to show: a row with no
    /// bytes says so, and never renders a broken-image glyph.
    public let bytes: String?

    public init(tier: Tier, mediaType: String, bytes: String?) {
        self.tier = tier
        self.mediaType = mediaType
        self.bytes = bytes
    }
}

/// What a Tool Call produced.
public enum ToolResult: Sendable, Equatable {
    case diff(DiffEvidence)
    case output(OutputEvidence)
    case media(MediaEvidence)
}
