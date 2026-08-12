@testable import ArgoEngine
import Testing

/// What a picker row can honestly say about a skill, read from the one place the CLI reads it.
@Suite("Skill frontmatter")
struct SkillFrontmatterTests {
    @Test
    func `reads the name and the one-line description a skill gives itself`() {
        let read = SkillFrontmatter(markdown: """
        ---
        name: code-review
        description: Review the changes since a fixed point.
        ---

        Two-axis review.
        """)
        #expect(read?.name == "code-review")
        #expect(read?.description == "Review the changes since a fixed point.")
    }

    @Test
    func `leaves the description absent when the skill carries none`() {
        let read = SkillFrontmatter(markdown: """
        ---
        name: implement
        ---

        Body.
        """)
        #expect(read?.name == "implement")
        #expect(read?.description == nil)
    }

    /// The three ways the installed skills on this machine actually spell one value, plus the two
    /// that must not survive the read: a key deeper in the document, and one that only looks like
    /// it.
    @Test(arguments: [
        DescriptionShape("plain", "description: Plain words.", reads: "Plain words."),
        DescriptionShape("double-quoted", "description: \"Words.\"", reads: "Words."),
        DescriptionShape("single-quoted", "description: 'Words.'", reads: "Words."),
        DescriptionShape(
            "folded",
            "description: >\n  Folded over\n  two lines.",
            reads: "Folded over two lines.",
        ),
        DescriptionShape(
            "folded, chomped",
            "description: >-\n  Folded over\n  two lines.",
            reads: "Folded over two lines.",
        ),
        DescriptionShape(
            "literal",
            "description: |\n  Kept as\n  two lines.",
            reads: "Kept as\ntwo lines.",
        ),
        DescriptionShape("indented under another key", "metadata:\n  description: Not mine."),
        DescriptionShape("named inside the body only", "other: 1\n---\ndescription: Prose."),
    ])
    func `takes the description whatever YAML shape it is written in`(shape: DescriptionShape) {
        let read = SkillFrontmatter(markdown: "---\nname: a-skill\n\(shape.body)\n---\n\nBody.")
        #expect(read?.description == shape.reads, "\(shape.label)")
    }

    /// One way a description can be written, and what a row should then read. `reads: nil` is a
    /// shape that must NOT answer — the key is there, but not as this skill's own description.
    struct DescriptionShape {
        let label: String
        let body: String
        let reads: String?

        init(_ label: String, _ body: String, reads: String? = nil) {
            self.label = label
            self.body = body
            self.reads = reads
        }
    }

    /// Nothing to read is not the same as a skill with no description: the file is not a skill at
    /// all, so it never becomes a row.
    @Test(arguments: [
        "Just prose, no fence.",
        "",
        "---\nname: unterminated\n\nBody with no closing fence.",
        " ---\nname: indented-fence\n---\n",
    ])
    func `reads nothing from a file that opens with no frontmatter fence`(markdown: String) {
        #expect(SkillFrontmatter(markdown: markdown) == nil)
    }

    /// A skill the CLI would list but whose frontmatter names nothing. It is still invocable by its
    /// directory, so the reader answers with no name rather than refusing the file.
    @Test
    func `leaves the name absent when the frontmatter states none`() {
        let read = SkillFrontmatter(markdown: "---\ndescription: Nameless.\n---\n")
        #expect(read?.name == nil)
        #expect(read?.description == "Nameless.")
    }
}
