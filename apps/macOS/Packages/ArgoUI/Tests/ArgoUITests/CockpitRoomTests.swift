import ArgoDesign
@testable import ArgoUI
import SwiftUI
import Testing

/// What a room tab says once it has stopped saying it in words (#690). A native tooltip is
/// invisible to a screenshot, so these strings are checked here or nowhere.
@Suite("Cockpit room")
struct CockpitRoomTests {
    @Test
    func `hovering a room offers the word its tab stopped drawing`() {
        #expect(CockpitRoom.sessions.tooltip == "Sessions — Command 1")
        #expect(CockpitRoom.tickets.tooltip == "Tickets — Command 2")
        #expect(CockpitRoom.code.tooltip == "Code — Command 3")
        #expect(CockpitRoom.atlas.tooltip == "Atlas — Command 4")
    }

    @Test
    func `a room speaks to VoiceOver the word its tab stopped drawing`() {
        #expect(CockpitRoom.sessions.voiceOverLabel == "Sessions, Command 1")
        #expect(CockpitRoom.tickets.voiceOverLabel == "Tickets, Command 2")
        #expect(CockpitRoom.code.voiceOverLabel == "Code, Command 3")
        #expect(CockpitRoom.atlas.voiceOverLabel == "Atlas, Command 4")
    }

    /// The literal, not the token: `symbol` is an unchecked name from an EXTERNAL catalog, and a
    /// name SF Symbols does not carry draws a blank tab rather than failing.
    @Test
    func `the Sessions room asks SF Symbols for a terminal window`() {
        #expect(CockpitRoom.sessions.symbol == "apple.terminal")
    }

    @Test
    func `no room draws the feed's mark for a command that ran`() {
        for room in CockpitRoom.allCases {
            #expect(room.symbol != ArgoSymbol.ran)
        }
    }

    /// The tab is its mark alone, so two rooms sharing one would be two tabs a reader cannot tell
    /// apart — with no word left to break the tie.
    @Test
    func `no two rooms draw the same mark`() {
        let marks = Set(CockpitRoom.allCases.map(\.symbol))
        #expect(marks.count == CockpitRoom.allCases.count)
    }

    /// The strip's agreed order, and the fourth segment the Atlas took (#1163).
    @Test
    func `the strip runs Sessions, Tickets, Code, Atlas`() {
        #expect(CockpitRoom.allCases == [.sessions, .tickets, .code, .atlas])
    }

    /// Command N is the room's position in the strip, not a number chosen apart from it — so a
    /// room reordered here and forgotten in `shortcut` cannot pass silently.
    @Test
    func `a room's shortcut is its own position in the strip`() {
        for (index, room) in CockpitRoom.allCases.enumerated() {
            #expect(room.shortcut == KeyEquivalent(Character("\(index + 1)")))
        }
    }
}
