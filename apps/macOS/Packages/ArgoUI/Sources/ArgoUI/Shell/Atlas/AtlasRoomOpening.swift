/// The state a room is SEEDED with, which is the state no screenshot can reach by itself: a file
/// open, a question asked, a folder descended into.
///
/// One value rather than three parameters, because they are one thought — where the reader already
/// was when the picture was taken — and because the room's host would otherwise be a fourth
/// parameter wider on every state a later ticket adds.
package struct AtlasRoomOpening {
    /// The file the room starts with open (#1154).
    package var opened: String?
    /// The question the room starts with asked (#1155).
    package var typed: String
    /// The folder the room starts INSIDE (#1156).
    package var entered: String?

    package init(opened: String? = nil, typed: String = "", entered: String? = nil) {
        self.opened = opened
        self.typed = typed
        self.entered = entered
    }

    /// The room as the app itself always opens it: the whole repository, nothing read, nothing
    /// asked.
    package static let none = AtlasRoomOpening()
}
