import ArgoEngine
@testable import ArgoUI
import Testing

/// Which way the panel reads a patch it could read two ways. Only markdown has two: every other
/// language IS its source.
@Suite("Evidence reading")
struct EvidenceReadingTests {
    /// A file the agent WROTE has no change in it to read — every line is an addition.
    @Test
    func `a markdown file the agent wrote opens as the document`() throws {
        let evidence = try opened("docs/spec.md", .create)

        #expect(evidence.offersProse)
        #expect(evidence.opening == .prose)
    }

    /// The rendered document has nowhere to put the half a modification took out.
    @Test
    func `a markdown file the agent changed opens as the patch`() throws {
        let evidence = try opened("docs/spec.md", .modify)

        #expect(evidence.offersProse)
        #expect(evidence.opening == .source)
    }

    @Test
    func `a patch in any other language has only the one reading`() throws {
        let evidence = try opened("Sources/FeedCall.swift", .create)

        #expect(!evidence.offersProse)
        #expect(evidence.opening == .source)
    }

    /// A read PRINTS the file, whole, with nothing taken out of it. The gutter the host wrote into
    /// the text comes off in `EvidenceListing` before anything renders it, so the gutter is no
    /// longer a reason to refuse the offer (#736).
    @Test
    func `a markdown file that was read opens as the document`() throws {
        let evidence = try printed("docs/spec.md", "    1\t## What I found")

        #expect(evidence.offersProse)
        #expect(evidence.opening == .prose)
    }

    @Test
    func `a file read in any other language has only the one reading`() throws {
        let evidence = try printed("Sources/FeedCall.swift", "    1\tlet a = 1")

        #expect(!evidence.offersProse)
    }

    /// A read of the MIDDLE of a file printed a slice, and a slice drawn as a document no longer
    /// says which lines it covers. The offer stands; the panel just does not open on it.
    @Test
    func `a read that started partway through the file opens as the source`() throws {
        let evidence = try printed("docs/spec.md", "   86→## What I found\n   87→Done.")

        #expect(evidence.offersProse)
        #expect(evidence.opening == .source)
    }

    /// Half a gutter is neither a listing nor a plain file: taking it off part-way is a guess, and
    /// left in it reaches the renderer as a paragraph opening on a number.
    @Test
    func `text that is only partly a listing is never offered as a document`() throws {
        let evidence = try printed(
            "docs/spec.md",
            "     1→## What I found\n     2→Done.\n(Results truncated)",
        )

        #expect(!evidence.offersProse)
    }

    /// A file's own path does not make a call's answer the file. An edit answered with a sentence
    /// rather than a patch printed a sentence about the call.
    @Test
    func `a markdown file that was edited rather than read offers no document reading`() throws {
        let file = try #require(FeedCall.FileName(path: "docs/spec.md"))
        let evidence = FeedCall(
            kind: .edit,
            subject: .file(file),
            churn: nil,
            ending: .succeeded,
            evidence: [.output(OutputEvidence(tier: .direct, text: "## Applied 1 edit"))],
            repeats: 1,
            spend: nil,
        ).opened

        #expect(!evidence.offersProse)
    }

    /// What a FAILED call printed is a message about the call, never the file — a sentence saying
    /// Argo could not read a `SKILL.md` is not a document, and a renderer would eat whatever
    /// punctuation it happens to carry.
    @Test
    func `a read that failed offers no document reading`() throws {
        let evidence = try printed("docs/spec.md", "No such file", ending: .failed)

        #expect(!evidence.offersProse)
        #expect(evidence.opening == .source)
    }

    private func printed(
        _ path: String,
        _ text: String,
        ending: FeedCall.Ending = .succeeded,
    ) throws
        -> FeedEvidence {
        let file = try #require(FeedCall.FileName(path: path))
        return FeedCall(
            kind: .read,
            subject: .file(file),
            churn: nil,
            ending: ending,
            evidence: [.output(OutputEvidence(tier: .direct, text: text))],
            repeats: 1,
            spend: nil,
        ).opened
    }

    private func opened(_ path: String, _ change: FileChange) throws -> FeedEvidence {
        let file = try #require(FeedCall.FileName(path: path))
        return FeedCall(
            kind: change == .create ? .create : .edit,
            subject: .file(file),
            churn: nil,
            ending: .succeeded,
            evidence: [.diff(DiffEvidence(
                tier: .direct,
                mutation: DiffEvidence.Mutation(change: change, destination: nil),
                patch: DiffEvidence.Patch(
                    added: 2,
                    removed: 0,
                    hunks: [DiffHunk(oldStart: 1, newStart: 1, lines: [
                        DiffLine(side: .add, text: "## What I found"),
                        DiffLine(side: .add, text: "The ramp had drifted navy."),
                    ])],
                ),
            ))],
            repeats: 1,
            spend: nil,
        ).opened
    }
}
