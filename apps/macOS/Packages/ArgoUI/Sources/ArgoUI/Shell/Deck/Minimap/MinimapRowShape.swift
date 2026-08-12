import Foundation

/// What a row is drawn as, held as the few numbers it takes rather than as the runs themselves
/// (#382).
///
/// This is the whole performance story of the lane. A reading is re-read whenever the feed
/// reshapes — at a real session's length, thousands of rows several times a second. So what a row
/// hands over has to be cheap to make and cheap to compare. The runs are built later, and only for
/// the band the lane actually holds as pixels.
///
/// Lengths are UTF-8 counts, which a Swift `String` answers in constant time. `count` walks the
/// whole string for graphemes, and a 50 KB message would be walked on every reshape.
enum MinimapRowShape: Equatable, Sendable {
    /// Lines of text against the leading edge, each as full as the words that landed on it.
    case prose(length: Int, ink: MinimapInk)
    /// The prompt's bubble, against the trailing edge, as one block.
    case bubble(length: Int)
    /// One line, as far across as the sentence got.
    case sentence(length: Int, ink: MinimapInk)
    /// A mutation: the sentence, and then what it did in lines.
    case change(length: Int, added: Int, removed: Int)
    /// A shape rather than a length — a picture's frame, a question's band, a Turn's rule.
    case whole(MinimapInk)
}
