import ArgoEngine
import ArgoFixtures
@testable import ArgoUI
import Testing

/// A file outside the tree the Session is working in (#380). The panel says every path relative to
/// the Session's cwd, so the marker is what stops a `~/Library` path looking like a repo path.
@Suite("External files")
struct FeedExternalFileTests {
    private static let cwd = "/Users/milad/Developer/argo"

    /// One address, and what the rule has to answer about it.
    struct Address {
        let named: String
        let address: String
        let isExternal: Bool
    }

    @Test(arguments: [
        Address(
            named: "a file in the tree",
            address: "apps/macOS/Package.swift",
            isExternal: false,
        ),
        Address(named: "the root itself", address: ".", isExternal: false),
        Address(named: "a home the shortening kept", address: "~/L/argo.log", isExternal: true),
        Address(named: "an absolute path elsewhere", address: "/etc/hosts", isExternal: true),
        Address(named: "a step upwards", address: "../other-repo/README.md", isExternal: true),
    ])
    func `an address the cwd could not account for is external`(_ subject: Address) {
        let path = FeedPath(cwd: Self.cwd)

        #expect(path.isExternal(subject.address) == subject.isExternal, "\(subject.named)")
    }

    /// A Session that never said where it was working marks nothing: every address in such a feed
    /// is absolute, so marking them all would report a gap in the record as a fact about the files.
    @Test
    func `a Session with no cwd marks nothing external`() {
        #expect(!FeedPath.anywhere.isExternal("/etc/hosts"))
        #expect(!FeedPath.anywhere.isExternal("~/Library/Logs/argo.log"))
    }

    /// Asked once, at the reading, and carried from there — through the row's subject and onto the
    /// step the panel draws, which is the one surface that says it.
    @Test
    func `the marker survives from the reading to the panel's step`() throws {
        let call = try #require(FeedFixture.calls(in: Self.reading(
            "/etc/hosts", printing: "127.0.0.1 localhost",
        )).first)

        #expect(call.isExternalSubject)
        #expect(call.opened.steps.map(\.isExternal) == [true])
    }

    /// The row is unchanged: the shortest thing that identifies the call, on one line.
    @Test
    func `a file inside the tree carries no marker at all`() throws {
        let call = try #require(FeedFixture.calls(in: Self.reading(
            "\(Self.cwd)/apps/macOS/Package.swift", printing: "// swift-tools-version",
        )).first)
        let inside = try #require(FeedCall.FileName(path: "apps/macOS/Package.swift"))

        #expect(!call.isExternalSubject)
        #expect(call.subject == .file(inside))
    }

    // MARK: - Fixtures

    /// One read, in a Session that said where it was working — without a cwd there is nothing for a
    /// path to be outside of.
    private static func reading(_ path: String, printing text: String) -> [TranscriptEvent] {
        [
            .cwd(cwd),
            .toolCall(FeedFixture.call("read-0", tool: "Read", kind: .read, naming: path)),
            .toolCallOutcome(TranscriptFixtures.printed("read-0", text)),
        ]
    }
}
