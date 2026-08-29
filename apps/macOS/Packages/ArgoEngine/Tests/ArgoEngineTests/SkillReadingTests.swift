@testable import ArgoEngine
import Foundation
import Testing

/// The seam the skills walk crosses to get off the main actor (#961, ADR-0028 Rule 6).
///
/// One case, because what the walk FINDS is `SkillCatalogTests`' subject. What is asserted here is
/// only that this reaches that walk with the roots it was handed — the reason a `@MainActor` caller
/// can be given a fixture home instead of the machine's own.
@Suite("Skill reading")
@MainActor
struct SkillReadingTests {
    @Test
    func `walks the roots it was handed`() async throws {
        let machine = try SkillCatalogFixture()
        try machine.write(FixtureSkill(directory: "ours", name: "ours"), into: machine.userSkills)

        let read = await SkillReading(homeURL: machine.homeURL)
            .skills(forProjectAt: machine.projectURL)

        #expect(read.map(\.command) == ["/ours"])
    }
}
