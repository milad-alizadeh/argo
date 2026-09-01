/// How much of a Session's record the reading behind it actually read.
///
/// A launch sweep reads the two ends of every transcript in the working set and nothing between
/// them (`TranscriptExcerpt`), because reading a week of them whole is 458 MB. What that buys is a
/// roster in a fraction of the time; what it costs is that any fact which is a SUM over the whole
/// file is now a sum over part of one — and a partial total rendered as a total is a false DIRECT
/// (`CONTEXT.md` Honesty tier).
///
/// So this is the fact everything of that shape is gated on: `HubSession+Spend` withholds its three
/// totals while the reading is an excerpt, which is degrade-down — absent, which every surface
/// already draws as unread, rather than a number that is wrong.
public enum SessionTranscriptExtent: Sendable, Equatable {
    /// Everything the file held has been read.
    case whole
    /// A stretch of the file was skipped.
    case excerpt
}
