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
    private static func project(holding skill: String) throws -> URL {
        let root = URL.temporaryDirectory.appending(path: "argo-skills-\(UUID().uuidString)")
        let folder = root.appending(path: ".claude/skills/\(skill)")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        try "---\nname: \(skill)\ndescription: A skill this Project installed.\n---\n"
            .write(to: folder.appending(path: "SKILL.md"), atomically: true, encoding: .utf8)
        return root
    }

    @Test func `a Project's own skills are in the catalog read for it`() async throws {
        let fixture = try BuiltinReaderFixture()
        let project = try Self.project(holding: "ship")
        defer { try? FileManager.default.removeItem(at: project) }

        let catalog = await fixture.reader().catalog(forProjectAt: project)

        #expect(catalog.commands.contains { $0.name == "ship" && $0.origin == .project })
    }

    /// A checkout with nothing installed contributes nothing and refuses nothing. Asserted on the
    /// PROJECT's own half alone: the user's folder and the enabled plugins are this machine's, and
    /// a test that counted them would be asserting whatever this Mac happens to have on it.
    @Test func `a Project with no skills folder contributes none`() async throws {
        let fixture = try BuiltinReaderFixture()
        let nowhere = URL.temporaryDirectory.appending(path: "argo-none-\(UUID().uuidString)")

        let catalog = await fixture.reader().catalog(forProjectAt: nowhere)

        #expect(!catalog.commands.contains { $0.origin == .project })
    }
}
