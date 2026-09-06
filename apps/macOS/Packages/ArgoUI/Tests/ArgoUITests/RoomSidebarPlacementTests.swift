@testable import ArgoUI
import Foundation
import Testing

/// Where the rooms picker sits vertically, held out of the repository's own source.
///
/// SwiftUI hands back no geometry a test can read, so the claim a render measured — every room's
/// strip on one vertical — cannot be asserted as a number here. What CAN be held is the shape that
/// produced it: one view places the strip, and the stage that stacks the rooms spells its spacing.
///
/// Both halves are load-bearing, and each one alone is green while the bug is back. A room that
/// writes its own stack around `RoomStrip` sets the inset again; a stage that goes back to an
/// implicit stack spaces the rooms 8pt apart and moves every strip below the first, however
/// carefully each room placed its own (`RoomSidebar`).
///
/// The numbers themselves are a render: 60pt in both rooms after the fix, against 60 and 68 before
/// it, off `roster` and `ticketsRoom`.
@Suite("Room strip placement")
struct RoomSidebarPlacementTests {
    /// The one view allowed to name `RoomStrip`, besides the strip's own file and its preview.
    @Test
    func `only the shared sidebar places the strip`() throws {
        let placing = try Self.shellSources.filter { url in
            try String(contentsOf: url, encoding: .utf8).contains("RoomStrip(selection:")
        }
        #expect(placing.map(\.lastPathComponent).sorted() == ["RoomSidebar.swift", "RoomStrip.swift"])
    }

    /// All three rooms reach it, so the shared placement is what every room is actually drawn by
    /// rather than a view one room happens to use.
    @Test
    func `every room's sidebar is composed through it`() throws {
        for room in ["Sidebar/ShellSidebar.swift", "Tickets/Sidebar/TicketsSidebar.swift",
                     "Atlas/AtlasSidebar.swift"] {
            let source = try String(contentsOf: Self.shell.appending(path: room), encoding: .utf8)
            #expect(source.contains("RoomSidebar(room:"), "\(room) places its own strip")
        }
    }

    /// The stage's spacing, spelled. An implicit stack gives each room the gap of every room above
    /// it, which is the 8pt the strip moved by between Sessions and Tickets.
    @Test
    func `the room stage spells its spacing`() throws {
        let stage = Self.shell.appending(path: "CockpitView+Tickets.swift")
        let source = try String(contentsOf: stage, encoding: .utf8)
        // The function alone: from its signature to the `}` that closes it, so a stack in some
        // other member of this file is not read as this one's.
        let after = try #require(source.components(separatedBy: "func sidebar(tickets:").last)
        let body = try #require(after.components(separatedBy: "\n    }\n").first)
        #expect(body.contains("VStack(spacing: ArgoSpacing.flush)"))
        // `Group` is the shape that carried the gap, and a `ZStack` costs the coordinator a second
        // body pass (ADR-0028 Rule 1). Neither is what this column may go back to being.
        for stack in ["Group {", "ZStack"] {
            #expect(!body.contains(stack), "the rooms are stacked again, by \(stack)")
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
            let all = FileManager.default.enumerator(at: shell, includingPropertiesForKeys: nil)
            let urls = (all?.allObjects as? [URL]) ?? []
            return urls.filter { $0.pathExtension == "swift" }
        }
    }
}
