@testable import ArgoEngine
import Foundation
import Testing

/// The Codex gate: what an approval becomes, what the answer puts on the wire, and who refuses a
/// call nobody answered (#549, ADR-0024).
///
/// Driven against the stand-in server, whose shapes are the ones the #547 spike recorded verbatim
/// against codex-cli 0.147.0. That the REAL server sends and honours them is `CodexLiveTests`.
@Suite("Codex approvals")
@MainActor
struct CodexApprovalTests {
    /// A prompt has to say what would run. The command is on the request itself, in full — a
    /// decision made on a truncated one is a guess.
    @Test
    func `a gated command names the tool and the command it would run`() {
        let peer = Self.opened()

        peer.server.askCommand(1, command: "/bin/zsh -lc 'rm -rf build'")

        let waiting = peer.readings.waiting.first
        #expect(waiting?.toolName == "commandExecution")
        #expect(waiting?.target == .command("/bin/zsh -lc 'rm -rf build'"))
    }

    /// The patch approval carries no diff of its own, so the target comes off the item the
    /// notifications already described. The join is the `itemId`.
    @Test
    func `a gated patch names the file it would write and what it would put there`() {
        let peer = Self.opened()
        peer.server.patched(
            "exec-7",
            path: "patched.txt",
            diff: "@@ -0,0 +1 @@\n+hello from patch",
        )

        peer.server.askPatch(2, itemID: "exec-7")

        #expect(peer.readings.waiting.first?.toolName == "fileChange")
        #expect(peer.readings.waiting.first?.target == .edit(
            path: "patched.txt",
            hunks: [[DiffLine(side: .add, text: "hello from patch")]],
        ))
    }

    /// The `diff` field means different things per kind, verified against codex-cli 0.147.0: a
    /// unified diff for `update`, the file's plain content for `add` and `delete`. Read without the
    /// kind, a deletion draws every removed line as an ADDITION — the one misrender a prompt the
    /// user is deciding on must not make.
    @Test(arguments: [
        (kind: "add", side: DiffLineSide.add),
        (kind: "delete", side: .del),
    ])
    func `a whole-file patch is drawn on the side its kind names`(
        patch: (kind: String, side: DiffLineSide),
    ) {
        let peer = Self.opened()
        peer.server.patched(
            "exec-8",
            path: "gone.txt",
            diff: "alpha\nbravo\n",
            kind: patch.kind,
        )

        peer.server.askPatch(4, itemID: "exec-8")

        #expect(peer.readings.waiting.first?.target == .edit(path: "gone.txt", hunks: [[
            DiffLine(side: patch.side, text: "alpha"),
            DiffLine(side: patch.side, text: "bravo"),
        ]]))
    }

    /// A kind this does not know degrades to the verbatim text rather than to a diff whose sides
    /// might be the wrong way round.
    @Test
    func `a patch of an unknown kind stays verbatim`() {
        let peer = Self.opened()
        peer.server.patched("exec-9", path: "odd.txt", diff: "alpha\n", kind: "teleport")

        peer.server.askPatch(5, itemID: "exec-9")

        #expect(peer.readings.waiting.first?.target == .raw("alpha\n"))
    }

    /// A patch whose diff never arrived is shown verbatim rather than as an edit of nothing: the
    /// user is deciding on it either way, and an empty diff would read as a change that writes
    /// nothing.
    @Test
    func `a gated patch with no diff yet stays verbatim`() {
        let peer = Self.opened()

        peer.server.askPatch(3, itemID: "exec-nothing-said")

        guard case .raw = peer.readings.waiting.first?.target else {
            Issue.record("expected a verbatim target, got \(peer.readings.waiting)")
            return
        }
    }

    @Test(arguments: [
        (decision: PermissionDecision.allow, word: "accept"),
        (decision: .allowAlways, word: "accept"),
        (decision: .deny, word: "decline"),
    ])
    func `a decision answers the request the server is blocked on`(
        answer: (decision: PermissionDecision, word: String),
    ) throws {
        let peer = Self.opened()
        peer.server.askCommand(4, command: "touch approved.txt")
        let waiting = try #require(peer.readings.waiting.first)

        #expect(peer.thread.approvals.decide(answer.decision, answering: waiting.id))

        #expect(peer.server.decision(4) == answer.word)
        #expect(peer.readings.waiting.isEmpty)
    }

    /// By id and never by position: a Session can have several calls waiting, and a prompt replaced
    /// between the reading and the click would spend the Allow on the command underneath.
    @Test
    func `a decision answers the named call and leaves its neighbour waiting`() throws {
        let peer = Self.opened()
        peer.server.askCommand(5, command: "touch first", itemID: "exec-1")
        peer.server.askCommand(6, command: "touch second", itemID: "exec-2")
        let second = try #require(peer.readings.waiting.last)

        #expect(peer.thread.approvals.decide(.deny, answering: second.id))

        #expect(peer.server.decision(6) == "decline")
        #expect(peer.server.decision(5) == nil)
        #expect(peer.readings.waiting.map(\.target) == [.command("touch first")])
    }

    @Test
    func `a decision for a call that is no longer waiting is refused`() {
        let peer = Self.opened()

        #expect(!peer.thread.approvals.decide(.allow, answering: "codex-permission-99"))
    }

    /// The grant is Argo's own — `acceptForSession` would make the server stop asking with no way
    /// back. So the next call to that tool never becomes a prompt, and the grant is revocable.
    @Test
    func `a standing allow stops that tool asking, and a revocation starts it again`() throws {
        let peer = Self.opened()
        peer.server.askCommand(7, command: "touch first")
        let waiting = try #require(peer.readings.waiting.first)
        #expect(peer.thread.approvals.decide(.allowAlways, answering: waiting.id))

        peer.server.askCommand(8, command: "touch second")

        #expect(peer.readings.standing.map(\.toolName) == ["commandExecution"])
        #expect(peer.server.decision(8) == "accept")
        #expect(peer.readings.waiting.isEmpty)

        #expect(peer.thread.approvals.revoke("commandExecution"))
        peer.server.askCommand(9, command: "touch third")
        #expect(peer.server.decision(9) == nil)
        #expect(peer.readings.waiting.count == 1)
    }

    /// A grant covers every call to that tool ALREADY waiting, too. A prompt still sitting there
    /// for a tool that has stopped asking would be the grant not meaning what its label says.
    @Test
    func `a standing allow lets the calls already waiting through on the same word`() throws {
        let peer = Self.opened()
        peer.server.askCommand(10, command: "touch first", itemID: "exec-1")
        peer.server.askCommand(11, command: "touch second", itemID: "exec-2")
        let first = try #require(peer.readings.waiting.first)

        #expect(peer.thread.approvals.decide(.allowAlways, answering: first.id))

        #expect(peer.server.decision(11) == "accept")
        #expect(peer.readings.waiting.isEmpty)
    }

    @Test
    func `a revocation of a grant this Session never held is refused`() {
        let peer = Self.opened()

        #expect(!peer.thread.approvals.revoke("commandExecution"))
    }

    /// The server keeps NO clock: a call nobody answers holds the Turn open for ever. So Argo's own
    /// runs out, Argo declines the call itself, and the Session says that is what happened.
    @Test
    func `a call nobody answers is declined by Argo's own clock`() async {
        let peer = Self.opened(patience: .immediate)

        peer.server.askCommand(12, command: "touch denied.txt")
        _ = await settle { !peer.readings.expiries.isEmpty }

        #expect(peer.server.decision(12) == "decline")
        #expect(peer.readings.expiries.map(\.toolName) == ["commandExecution"])
        #expect(peer.readings.waiting.isEmpty)
    }

    // That an answered call's timer never fires behind the answer is the `PatienceTable`'s
    // invariant now, asserted once over the table itself (#750) rather than a third time here.

    private static func opened(patience: PermissionPatience = .default) -> CodexPeer {
        let peer = CodexPeer(patience: patience)
        peer.thread.begin()
        peer.server.open()
        return peer
    }
}
