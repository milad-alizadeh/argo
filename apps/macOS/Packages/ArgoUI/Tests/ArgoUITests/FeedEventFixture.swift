import AppKit

/// The real presses a cursor case states, synthesised rather than described: every claim about the
/// cursor is a claim about what `NSTableView` and the responder chain do with an EVENT, and a
/// method called directly would be a claim about the coordinator instead.
@MainActor enum FeedEventFixture {
    /// A left-click at the table's own origin.
    static func click(in table: NSTableView) -> NSEvent {
        NSEvent.mouseEvent(
            with: .leftMouseDown,
            location: table.bounds.origin,
            modifierFlags: [],
            timestamp: 0,
            windowNumber: 0,
            context: nil,
            eventNumber: 0,
            clickCount: 1,
            pressure: 1,
        ) ?? NSEvent()
    }

    /// A down-arrow press.
    static func arrowDown() -> NSEvent {
        key(characters: "\u{F701}", flags: [.function, .numericPad], code: 125)
    }

    /// A Tab press — the one key that steers the keyboard INTO a reading, as against the ones that
    /// merely happened to be the last event the app saw.
    static func tab() -> NSEvent {
        key(characters: "\t", flags: [], code: 48)
    }

    /// An Escape press — how the reader closes a panel by keyboard, as against its close button.
    static func escape() -> NSEvent {
        key(characters: "\u{1B}", flags: [], code: 53)
    }

    private static func key(
        characters: String,
        flags: NSEvent.ModifierFlags,
        code: UInt16,
    )
        -> NSEvent {
        NSEvent.keyEvent(
            with: .keyDown,
            location: .zero,
            modifierFlags: flags,
            timestamp: 0,
            windowNumber: 0,
            context: nil,
            characters: characters,
            charactersIgnoringModifiers: characters,
            isARepeat: false,
            keyCode: code,
        ) ?? NSEvent()
    }
}
