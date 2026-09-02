import ArgoDesign
@testable import ArgoUI
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
    }

    @Test
    func `a room speaks to VoiceOver the word its tab stopped drawing`() {
        #expect(CockpitRoom.sessions.voiceOverLabel == "Sessions, Command 1")
        #expect(CockpitRoom.tickets.voiceOverLabel == "Tickets, Command 2")
        #expect(CockpitRoom.code.voiceOverLabel == "Code, Command 3")
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
}
