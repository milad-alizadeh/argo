import ArgoEngine
@testable import ArgoUI
import Testing

/// Which language a path is, read from the name and never guessed from the contents. Argo keeps no
/// grammar of its own and no theme of its own — the dependency does both — so this is the part Argo
/// actually owns.
@Suite("Evidence language")
struct EvidenceLanguageTests {
    @Test
    func `a language is read from the extension`() {
        #expect(EvidenceLanguage(path: "Sources/ArgoUI/FeedCall.swift") == .swift)
        #expect(EvidenceLanguage(path: "apps/web/src/main.tsx") == .typescript)
        #expect(EvidenceLanguage(path: "cmd/argo/main.go") == .golang)
        #expect(EvidenceLanguage(path: "docs/adr/0022.md") == .markdown)
        #expect(EvidenceLanguage(path: "scripts/screenshot.sh") == .shell)
    }

    /// A fence names its own language, and people name it either way — the language or the
    /// extension they would have put on the file. Both resolve to one grammar.
    @Test
    func `a fence's declared language is read from the word the agent wrote`() {
        #expect(EvidenceLanguage(declared: "swift") == .swift)
        #expect(EvidenceLanguage(declared: "ts") == .typescript)
        #expect(EvidenceLanguage(declared: "bash") == .shell)
        #expect(EvidenceLanguage(declared: "GO") == .golang)
        #expect(EvidenceLanguage(declared: " yaml ") == .yaml)
    }

    /// A fence with no info string, or one naming something Argo has no grammar for, is drawn as
    /// it arrived. Guessing at the characters inside it is the thing this whole type refuses.
    @Test
    func `a fence declaring nothing Argo knows takes no grammar`() {
        #expect(EvidenceLanguage(declared: "") == nil)
        #expect(EvidenceLanguage(declared: "mermaid") == nil)
        #expect(EvidenceLanguage(declared: "text") == nil)
    }

    /// The alias is highlight.js's word, not Argo's. `golang` is named that way to clear the house
    /// identifier floor, and the grammar still has to be asked for by the name it answers to.
    @Test
    func `every language asks the grammar for itself by the name it answers to`() {
        #expect(EvidenceLanguage.golang.alias == "go")
        #expect(EvidenceLanguage.allCases.allSatisfy { !$0.alias.isEmpty })
    }

    /// A file Argo cannot name is drawn plain. Guessing from the contents would be Argo asserting
    /// a language the record never carried, and the honest answer costs nothing but colour.
    @Test
    func `a name carrying no extension Argo knows has no language`() {
        #expect(EvidenceLanguage(path: "Makefile") == nil)
        #expect(EvidenceLanguage(path: "docs/notes.wat") == nil)
        #expect(EvidenceLanguage(path: "") == nil)
    }

    /// The panel's header is open on what HAPPENED, so it takes the call's own mark whatever the
    /// subject was. The language's mark belongs to a step, beside the one address it is true of —
    /// a header carrying it would be claiming a language across four files.
    @Test
    func `the header takes the mark of what the call was, never the language's`() throws {
        #expect(try opened(.read, file: "Makefile").symbol == ArgoSymbol.read)
        #expect(try opened(.read, file: "FeedCall.swift").symbol == ArgoSymbol.read)
        #expect(opened(.execute, .command("bun run quality")).symbol == ArgoSymbol.ran)
    }

    /// The plain document survives for the one honest gap: a call whose kind Argo could not read,
    /// naming something it could not place either.
    @Test
    func `a call Argo could not classify takes the plain mark`() {
        #expect(opened(.unclassified, .plain("some_tool")).symbol == ArgoSymbol.plainSource)
    }

    /// The language rides on the STEP, which is what lets one panel colour four files by four
    /// grammars — and lets a command's output stay uncoloured beside them.
    @Test
    func `each step carries the language of its own address`() throws {
        #expect(try opened(.read, file: "FeedCall.swift").steps.map(\.language) == [.swift])
        #expect(opened(.execute, .command("bun run quality")).steps.map(\.language) == [nil])
    }

    private func opened(_ kind: FeedCall.Kind, file path: String) throws -> FeedEvidence {
        let file = try #require(FeedCall.FileName(path: path))
        return opened(kind, .file(file))
    }

    private func opened(_ kind: FeedCall.Kind, _ subject: FeedCall.Subject) -> FeedEvidence {
        FeedCall(
            kind: kind,
            subject: subject,
            churn: nil,
            ending: .succeeded,
            evidence: [.output(OutputEvidence(tier: .direct, text: "all:"))],
            repeats: 1,
            spend: nil,
        ).opened
    }
}
