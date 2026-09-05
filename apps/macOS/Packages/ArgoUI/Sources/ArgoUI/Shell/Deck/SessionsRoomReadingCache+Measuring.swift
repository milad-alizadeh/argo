/// The key one chip's measured figures are remembered under — lifted out of the cache's own body
/// so that body stays inside the length the gate holds it to (`type_body_length`), and because it
/// is a value about a SUBAGENT rather than about the room's reading.
extension SessionsRoomReadingCache {
    /// What one chip's derived figures are a function of: which Subagent, and when Argo last
    /// watched that Subagent's own file grow. The stamp above stops at the Session's own stream, so
    /// this is what moves when the CHILD writes — the same job `Scoping`'s length does, for the
    /// same
    /// reason (#858).
    ///
    /// The growth stamp and not a length, and `FeedAgentReader.measures(of:)` carries why: a key
    /// read off the events themselves puts a file lookup per chip on the warm pass, and a length
    /// would miss a child's own branch replaced in place (#1202).
    struct Measuring: Hashable {
        let subagentID: String
        /// `Hub.subagentGrewAtMs(of:)`, and `nil` for a child Argo has never watched write — which
        /// is a reading that is not moving rather than an unknown one.
        let grewAtMs: Int?
    }
}
