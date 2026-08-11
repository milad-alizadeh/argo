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

    /// A `Read`'s output arrives with the host's line numbers written into the text. Drawing
    /// `    12\t## What I found` through a markdown renderer produces a document that is not the
    /// file, so the offer is made for patches only.
    @Test
    func `a markdown file that was only read offers no document reading`() throws {
        let file = try #require(FeedCall.FileName(path: "docs/spec.md"))
        let call = FeedCall(
            kind: .read,
            subject: .file(file),
            churn: nil,
            ending: .succeeded,
            evidence: [.output(OutputEvidence(tier: .direct, text: "    1\t## What I found"))],
            repeats: 1,
            spend: nil,
        )

        #expect(!call.opened.offersProse)
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
                change: change,
                destination: nil,
                added: 2,
                removed: 0,
                hunks: [DiffHunk(oldStart: 1, newStart: 1, lines: [
                    DiffLine(side: .add, text: "## What I found"),
                    DiffLine(side: .add, text: "The ramp had drifted navy."),
                ])],
            ))],
            repeats: 1,
            spend: nil,
        ).opened
    }
}
