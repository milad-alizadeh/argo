@testable import ArgoEngine
import Foundation
import Testing

/// The seam the skills walk crosses to get off the main actor (#961, ADR-0028 Rule 6).
///
/// `@MainActor` on the suite on purpose: it is the caller the rule is about, and a `SkillReading`
/// that stopped being an actor would stop making these `await`s mean anything.
@Suite("Skill reading")
@MainActor
struct SkillReadingTests {
    let machine: SkillCatalogFixture

    init() throws {
        self.machine = try SkillCatalogFixture()
    }

    @Test
    func `answers the same skills the walk finds, from off the main actor`() async throws {
        try machine.write(
            FixtureSkill(directory: "code-review", name: "code-review", description: "A diff."),
            into: machine.projectSkills,
        )

        let read = await SkillReading(homeURL: machine.homeURL)
            .skills(forProjectAt: machine.projectURL)

        #expect(read.map(\.command) == ["/code-review"])
    }

    /// The user's own folder is a root the reader is HANDED, so a test never reads this machine's.
    @Test
    func `reads the user's global skills out of the home it was given`() async throws {
        try machine.write(FixtureSkill(directory: "ours", name: "ours"), into: machine.userSkills)

        let read = await SkillReading(homeURL: machine.homeURL)
            .skills(forProjectAt: machine.projectURL)

        #expect(read.map(\.origin) == [.user])
    }
}
