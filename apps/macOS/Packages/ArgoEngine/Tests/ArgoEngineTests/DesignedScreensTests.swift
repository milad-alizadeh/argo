@testable import ArgoEngine
import Foundation
import Testing

/// Which screens a Project has settled a design for (#899) — the tree lookup rule 1 of the command
/// mapping cannot be decided without.
@Suite("Designed screens")
struct DesignedScreensTests {
    @Test(arguments: [
        ("cockpit-work-room.md", "work-room"),
        ("cockpit-composer-picker.md", "composer-picker"),
        ("cockpit-work-room.inventory.md", "work-room"),
    ])
    func `a design names the screen it settles`(entry: String, screen: String) {
        #expect(DesignedScreens.screen(of: entry) == screen)
    }

    /// A screen is settled by its STUDY and by nothing else. The index, the reference shots, and
    /// the render folders named after a study are all about the folder rather than about a surface
    /// — and counting the folders would settle `renders` and `prototypes`, which nobody ever drew.
    @Test(arguments: [
        "README.md", "index.json", "renders", "prototypes", "work-room",
        "cockpit-sessions-liquid-glass.png",
    ])
    func `an entry that is not a study names no screen`(entry: String) {
        #expect(DesignedScreens.screen(of: entry) == nil)
    }

    @Test func `the screens are read from the Project's own designs folder`() throws {
        let project = URL.temporaryDirectory.appending(path: "argo-designs-\(UUID().uuidString)")
        let designs = project.appending(path: DesignedScreens.folder)
        try FileManager.default.createDirectory(
            at: designs.appending(path: "work-room"), withIntermediateDirectories: true,
        )
        try Data().write(to: designs.appending(path: "cockpit-work-room.md"))
        try Data().write(to: designs.appending(path: "cockpit-composer-picker.md"))
        try Data().write(to: designs.appending(path: "README.md"))
        defer { try? FileManager.default.removeItem(at: project) }

        #expect(DesignedScreens(projectURL: project).screens() == ["work-room", "composer-picker"])
    }

    /// A checkout with no design folder has settled no design — an empty answer, never a refusal:
    /// every Ticket in it falls through rule 1 to the label-driven rules below it.
    @Test func `a Project with no designs folder has settled no screen`() {
        let nowhere = URL.temporaryDirectory.appending(path: "argo-absent-\(UUID().uuidString)")

        #expect(DesignedScreens(projectURL: nowhere).screens().isEmpty)
    }
}
