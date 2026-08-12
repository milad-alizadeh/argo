import Foundation

/// What a row is drawn as, held as the few numbers it takes rather than as the runs themselves
/// (#382). One of these is built for every row whenever the feed reshapes, so it must stay cheap to
/// make and cheap to compare; the runs are built later, for the band alone.
///
/// Lengths are UTF-8 counts, which a `String` answers in constant time where `count` walks
/// graphemes.
enum MinimapRowShape: Equatable, Sendable {
    /// Lines of text against the leading edge, each as full as the words that landed on it.
    case prose(length: Int, ink: FeedInk)
    /// Prose with markdown structure in it: the blocks themselves, so a table reads as its grid, a
    /// fence as its slab, and a link in its own ink. See `MinimapProseBlock`.
    case composed(blocks: [MinimapProseBlock], ink: FeedInk)
    /// The prompt's lines, against the trailing edge, each as full as the words that landed on it.
    case bubble(length: Int)
    /// One line, as far across as the sentence got.
    case sentence(length: Int, ink: FeedInk)
    /// A mutation: the sentence, and then what it did in lines.
    case change(length: Int, added: Int, removed: Int)
    /// A run of pictures, as the count of them. The lane wraps that many frames across itself the
    /// way the row wraps that many thumbnails across the column, so a turn that rendered six shots
    /// reads as six shots rather than as one grey slab.
    case shots(count: Int)
    /// A shape rather than a length — a question's band, a Turn's rule.
    case whole(FeedInk)
}
