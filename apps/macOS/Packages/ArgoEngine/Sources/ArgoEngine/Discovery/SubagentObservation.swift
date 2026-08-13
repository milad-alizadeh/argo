import Foundation

/// One Subagent's own record, and the typed events read from it.
///
/// `TranscriptObservation` restated for a child, minus the two things only a Session needs: no
/// chain to stitch, so no join id, and no roster row to sort, so no modification time to fall back
/// on. What a Subagent needs instead is the id that names it, which no transcript carries.
public struct SubagentObservation: Sendable {
    /// The CLI's own id for the Subagent. The join key: the delegating call reports this same
    /// string, which is what ties this reading to the chip that opens it.
    public let agentID: String
    public let sourceURL: URL
    /// Batched exactly as a Session's are, the first batch being the backfill of what the file
    /// already held. The stream does not finish on its own — a Subagent's file goes on growing
    /// after the parent falls quiet.
    public let events: AsyncStream<[TranscriptEvent]>
}
