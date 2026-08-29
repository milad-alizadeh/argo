@testable import ArgoEngine
import Foundation
import Testing

/// The picker's whole catalog for one Project, joined where a test can reach it (#899).
///
/// The join used to live in the app target's wiring, which the e2e suite never builds — it launches
/// onto `--specimen` and never assembles `CockpitView` at all (ADR-0022).
@Suite("Skill catalog join")
@MainActor
struct SkillCatalogJoinTests {
    /// One skill under a root's `.claude/skills`, which is where both a Project's own and the
    /// user's global ones live.
    @discardableResult
    private static func write(_ skill: String, under root: URL) throws -> URL {
        let folder = root.appending(path: ".claude/skills/\(skill)")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try "---\nname: \(skill)\ndescription: A skill this Project installed.\n---\n"
            .write(to: folder.appending(path: "SKILL.md"), atomically: true, encoding: .utf8)
        return root
    }

    private static func project(holding skill: String) throws -> URL {
        let root = URL.temporaryDirectory.appending(path: "argo-skills-\(UUID().uuidString)")
        return try write(skill, under: root)
    }

    @Test func `a Project's own skills are in the catalog read for it`() async throws {
        let fixture = try BuiltinReaderFixture()
        let project = try Self.project(holding: "ship")
        defer { try? FileManager.default.removeItem(at: project) }

        let catalog = await fixture.reader().catalog(forProjectAt: project)

        #expect(catalog.commands.contains { $0.name == "ship" && $0.origin == .project })
    }

    /// The user's global half of the join, off the fixture's own home rather than this machine's.
    @Test func `the user's own skills are in the catalog read for a Project`() async throws {
        let fixture = try BuiltinReaderFixture()
        try Self.write("grill", under: fixture.homeURL)

        let catalog = await fixture.reader().catalog(forProjectAt: fixture.projectURL)

        #expect(catalog.commands.contains { $0.name == "grill" && $0.origin == .user })
    }

    /// A checkout with nothing installed contributes nothing and refuses nothing.
    @Test func `a Project with no skills folder contributes none`() async throws {
        let fixture = try BuiltinReaderFixture()
        let nowhere = URL.temporaryDirectory.appending(path: "argo-none-\(UUID().uuidString)")

        let catalog = await fixture.reader().catalog(forProjectAt: nowhere)

        #expect(!catalog.commands.contains { $0.origin == .project })
    }
}
