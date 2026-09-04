/// What a Session's transcript said, held with one small value that stands for it (ADR-0028 Rule
/// 1).
///
/// A stream is compared by walking it, and the cockpit's projection carries every Session's whole
/// decoded stream as a value SwiftUI diffs field by field — so one body pass could deep-compare N
/// Sessions by thousands of events each. The stamp is what makes that an integer comparison.
///
/// Correctness is the stamp's and never a reader's: a stamp that can stand still while the stream
/// moves is a rendered lie rather than a slow read (`CONTEXT.md` Honesty tier). So the records are
/// PRIVATE and every write goes through a `didSet` that restamps — exhaustive by the compiler
/// rather than by anyone remembering.
struct TranscriptStream: Sendable {
    private(set) var stamp = TranscriptStamp()
    private var records: [TranscriptEvent] = [] {
        didSet { restamp() }
    }

    var events: [TranscriptEvent] {
        records
    }

    /// One event onto the stream — except the one event that takes events OFF it.
    ///
    /// `superseded` is a fact about the READING rather than a thing anybody said (#1202): it names
    /// the record a branch the CLI abandoned opened, and what has to go is everything the stream
    /// has taken since. Answered HERE and not by a caller, because this type owns every write to
    /// `records` and is the only thing that can be trusted to restamp after one — a caller that
    /// dropped a branch itself would be a write nothing counted.
    mutating func append(_ event: TranscriptEvent) {
        guard case let .superseded(record) = event else {
            return records.append(event)
        }
        dropBranch(openedBy: record)
    }

    /// The later half of a resume chain, appended — see `HubSession.mergeContinuation`.
    ///
    /// The continuation's own write count is folded in, and that is the one place a count alone
    /// would lie: every rebuild re-runs the SAME two writes over the same root, so a merge of a
    /// continuation that has since grown would otherwise land on the stamp the shorter one gave it.
    mutating func merge(_ continuation: TranscriptStream) {
        records += continuation.records
        stamp.fold(continuation.stamp)
    }

    /// Take back everything from the record that OPENED an abandoned branch onward (#1202).
    ///
    /// The search runs BACKWARDS and stops at the first excerpt seam, which is what bounds it: a
    /// fork's abandoned branch is the tail of the stream, because the record superseding it is the
    /// one being read now. A uuid this reading never held — behind a bounded read's seam, in a link
    /// of the chain that is somebody else's file, or already dropped by an earlier read of the same
    /// file — is a miss, and a miss drops NOTHING: an emptied feed is a worse answer than a doubled
    /// row (`CONTEXT.md` Honesty tier).
    private mutating func dropBranch(openedBy uuid: String) {
        var index = records.endIndex
        while index > records.startIndex {
            index -= 1
            if case .excerpted = records[index] {
                return
            }
            guard case let .recordIdentity(seen) = records[index], seen == uuid else { continue }
            records.removeSubrange(index...)
            return
        }
    }

    private mutating func restamp() {
        stamp.wrote(events: records.count)
    }
}

/// A write count and a length never make the same pair twice — see `TranscriptStream`, which is the
/// only thing that may move one.
extension TranscriptStream: Equatable {
    /// The stamp is deliberately OUT of this: it is a change detector for the cockpit, and two
    /// streams holding the same events by different write histories are still the same stream.
    /// `HubSession`'s own equality is what this preserves.
    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.records == rhs.records
    }
}
