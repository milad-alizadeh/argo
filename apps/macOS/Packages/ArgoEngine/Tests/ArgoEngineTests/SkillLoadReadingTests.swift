@testable import ArgoEngine
import Testing

// What the record says when a Session was handed a skill (#688), and what Argo can honestly show
// behind it. The record names a directory; everything else is read from the `SKILL.md` under it,
// through the same frontmatter reader the picker uses.

@Suite("Skill load reading")
struct SkillLoadReadingTests {
    private func loads(
        _ fixture: String,
        readSkill: @escaping SkillReader = noSkillReader,
    ) async throws
        -> [SkillLoad] {
        try await Fixture.events(fixture, readSkill: readSkill).compactMap { event in
            guard case let .skillLoaded(load) = event else { return nil }
            return load
        }
    }

    /// The one skill the noise fixture loads sits at `.claude/skills/implement`.
    private let implement = "/Users/x/argo/.claude/skills/implement"

    @Test
    func `A skill the CLI handed over is an event of its own, not a prompt`() async throws {
        let read = try await loads("harnessNoise")

        #expect(read.map(\.directory) == [implement])
    }

    @Test
    func `The name is the one the skill states about itself`() async throws {
        let read = try await loads("harnessNoise", readSkill: reading("""
        ---
        name: implement-fanout
        ---

        One ticket at a time.
        """))

        // A name that is NOT the directory's, so the assertion discriminates: the fixture's
        // directory is `implement`, and every real skill on this machine agrees with its folder.
        #expect(read.first?.name == "implement-fanout")
    }

    /// A `SKILL.md` states a name almost always, and the directory is what the CLI addressed it by
    /// when it does not.
    @Test
    func `A skill that states no name is known by the directory the CLI named`() async throws {
        let read = try await loads("harnessNoise", readSkill: reading("Body with no frontmatter."))

        #expect(read.first?.name == "implement")
    }

    @Test
    func `The body behind the marker is the markdown under the frontmatter`() async throws {
        let read = try await loads("harnessNoise", readSkill: reading("""
        ---
        name: implement
        description: Implement one ticket.
        ---

        One ticket at a time.
        """))

        #expect(read.first?.body == .read("One ticket at a time."))
    }

    /// A file that can no longer be read is SAID so, rather than passed over: the marker stands
    /// either way, and a reader who clicks it learns why there is nothing there.
    @Test
    func `A skill file nothing could read states the failure`() async throws {
        let read = try await loads("harnessNoise")

        guard case let .unreadable(why) = try #require(read.first?.body) else {
            Issue.record("a file that could not be read says so")
            return
        }
        #expect(why.contains("\(implement)/SKILL.md"))
    }

    /// Frontmatter and nothing else. The marker still stands — the skill WAS loaded — but there is
    /// nothing to open, and an empty panel would claim a reading Argo does not have.
    @Test
    func `A skill whose file is all frontmatter has nothing behind its marker`() async throws {
        let read = try await loads("harnessNoise", readSkill: reading("""
        ---
        name: implement
        ---

        """))

        #expect(read.first?.body == nil)
    }

    /// One `SKILL.md`, whatever is asked for. The path is checked by the tests that care about it.
    private func reading(_ markdown: String) -> SkillReader {
        { _ in markdown }
    }
}
