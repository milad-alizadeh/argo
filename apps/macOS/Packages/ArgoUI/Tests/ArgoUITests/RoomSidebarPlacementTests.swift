@testable import ArgoUI
import Foundation
import Testing

/// Where the rooms picker sits vertically, held out of the repository's own source.
///
/// SwiftUI hands back no geometry a test can read, so the claim a render measured — every room's
/// strip on one vertical — cannot be asserted as a number here. What CAN be held is the shape that
/// produced it: one view places the strip, and the stage that stacks the rooms spells its spacing.
/// Each half alone is green while the bug is back, which is why there are three tests and not one.
/// The numbers, and what they cost, are on `CockpitView.sidebar(tickets:)`.
@Suite("Room strip placement")
struct RoomSidebarPlacementTests {
    /// `RoomSidebar` is the only view that places the strip. `RoomStrip.swift` is exempt because it
    /// declares it — a test that expected that file in the list would start failing the day its
    /// `#Preview` went away, and say the rooms had gone back to placing their own.
    @Test
    func `only the shared sidebar places the strip`() throws {
        let sources = try Self.shellSources
        #expect(sources.count > 1, "the sweep found nothing, so it proves nothing")
        let placing = try sources
            .filter { $0.lastPathComponent != "RoomStrip.swift" }
            .filter { try String(contentsOf: $0, encoding: .utf8).contains("RoomStrip(selection:") }
        #expect(placing.map(\.lastPathComponent) == ["RoomSidebar.swift"])
    }

    /// The window has FOUR rooms and three sidebars: Code is drawn by `ShellSidebar`, the same one
    /// Sessions is drawn by, because the stage gates on Tickets and the Atlas and hands everything
    /// else to it. So "every room's strip is placed by one view" only holds while that stays true —
    /// a Code room that grows its own sidebar has a strip nobody placed, and the sweep below would
    /// still be green. This is what says so out loud.
    @Test
    func `the rooms are four, and the sidebars three`() throws {
        #expect(CockpitRoom.allCases.map(\.rawValue) == ["sessions", "tickets", "code", "atlas"])
        let stage = Self.shell.appending(path: "CockpitView+Tickets.swift")
        let source = try String(contentsOf: stage, encoding: .utf8)
        // The Sessions sidebar takes every room the other two do not name, which is how Code is
        // covered. A fourth sidebar in the stage breaks this, and should.
        #expect(source.contains(".room(isActive: !isTickets && !isAtlas)"))
    }

    /// All three sidebars reach it, so the shared placement is what every room is actually drawn by
    /// rather than a view one room happens to use.
    @Test
    func `every room's sidebar is composed through it`() throws {
        for room in [
            "Sidebar/ShellSidebar.swift",
            "Tickets/Sidebar/TicketsSidebar.swift",
            "Atlas/AtlasSidebar.swift",
        ] {
            let source = try String(contentsOf: Self.shell.appending(path: room), encoding: .utf8)
            #expect(source.contains("RoomSidebar(room:"), "\(room) places its own strip")
        }
    }

    /// The stage's spacing, spelled rather than a `Group`'s implicit 8pt.
    @Test
    func `the room stage spells its spacing`() throws {
        let stage = Self.shell.appending(path: "CockpitView+Tickets.swift")
        let source = try String(contentsOf: stage, encoding: .utf8)
        // The function alone: from its signature to the `}` that closes it, so a stack in some
        // other member of this file is not read as this one's.
        let declaration = try #require(source.components(separatedBy: "func sidebar(tickets:").last)
        let function = try #require(declaration.components(separatedBy: "\n    }\n").first)
        #expect(function.contains("VStack(spacing: ArgoSpacing.flush)"))
        // `Group` is the shape that carried the gap, and a `ZStack` costs the coordinator a second
        // body pass (ADR-0028 Rule 1). Neither is what this column may go back to being.
        for stack in ["Group {", "ZStack"] {
            #expect(!function.contains(stack), "the rooms are stacked again, by \(stack)")
        }
    }

    /// The file in the repository, not the built module: a layout leaves nothing in the binary to
    /// read back, and an `ArgoUI` test builds the package the source sits in. The route
    /// `SessionCommandShortcutsTests` takes for the same reason.
    private static let shell = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .appending(path: "Sources/ArgoUI/Shell")

    /// Every Swift file under `Shell/`, so a fourth room added tomorrow is inside the sweep
    /// without anybody remembering to list it here.
    private static var shellSources: [URL] {
        get throws {
            let walk = FileManager.default.enumerator(at: shell, includingPropertiesForKeys: nil)
            let urls = try #require(walk?.allObjects as? [URL])
            return urls.filter { $0.pathExtension == "swift" }
        }
    }
}
