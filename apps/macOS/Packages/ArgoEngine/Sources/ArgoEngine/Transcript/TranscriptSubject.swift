/// Whose record a reader is reading: a Session's own, or one Subagent's.
///
/// It decides four guards, all of them on `isSidechain`. They exist to keep a child's facts off the
/// PARENT's reading — its spend, its Turn boundaries and its Plan are the child's, and folded up
/// they would bill delegated tokens twice, close the root's Turn on a delegate's, and put a
/// subagent's steps on the Session's plan pill. When the child's own file IS the subject every
/// record in it is a sidechain, so the same guards would leave that reading with none of the three.
public enum TranscriptSubject: Sendable, Equatable {
    case session
    case subagent
}
