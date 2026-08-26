@testable import ArgoEngine
import Foundation
import Testing

/// What Argo says to `codex app-server`, and what it does with what comes back (#548, ADR-0024).
///
/// The assertions are on the protocol the server sees — the method, the thread it names, the input
/// items — because that is what a CLI on the other end can observe. Nothing here asserts the shape
/// of a line's serialisation.
@Suite("Codex thread")
@MainActor
struct CodexThreadTests {
    @Test
    func `the handshake asks for a thread on the rung it was opened at`() {
        let peer = CodexPeer(cwd: "/work", mode: .readOnly)
        peer.thread.begin()

        #expect(peer.server.request("initialize") != nil)
        peer.server.open()

        let start = peer.server.request("thread/start")
        #expect(start?.params.stringField("cwd") == "/work")
        #expect(start?.params.stringField("sandbox") == "read-only")
        // `initialized` is a notification and carries no id, so it is not among the requests.
        #expect(peer.server.lines.contains { $0.stringField("method") == "initialized" })
    }

    /// The composer is live from the moment the Session appears, and the handshake is three
    /// messages deep. A Turn typed into that window is held, not lost and not refused.
    @Test
    func `a Turn typed before the thread exists arrives when it does`() {
        let peer = CodexPeer()
        peer.thread.begin()

        #expect(peer.thread.send("First thought"))
        #expect(peer.thread.send("Second thought"))
        #expect(peer.server.turns.isEmpty)

        peer.server.open()

        #expect(peer.server.turns.count == 2)
        #expect(text(of: peer.server.turns.first) == "First thought")
        #expect(text(of: peer.server.turns.last) == "Second thought")
    }

    @Test
    func `multi-line text is one Turn, verbatim`() {
        let peer = CodexPeer()
        peer.thread.begin()
        peer.server.open()
        let typed = "Fix the caption\n\nthen `git commit -m \"done\"` — do not push"

        #expect(peer.thread.send(typed))

        #expect(peer.server.turns.count == 1)
        #expect(text(of: peer.server.turns.first) == typed)
    }

    /// The Turn names every attachment's path in its words, and hands the IMAGES to the server as
    /// input items besides — the fidelity difference ADR-0024 records.
    @Test
    func `an attached image rides on the Turn as an input item of its own`() {
        let peer = CodexPeer()
        peer.thread.begin()
        peer.server.open()
        peer.thread.willSend(images: [URL(filePath: "/tmp/shot.png")])

        #expect(peer.thread.send("What is wrong with this?"))

        let input = peer.server.turns.first?["input"]?.array ?? []
        #expect(input.count == 2)
        #expect(input.last?.stringField("type") == "localImage")
        #expect(input.last?.stringField("path") == "/tmp/shot.png")
    }

    @Test
    func `the images go with the Turn that named them and not with the next one`() {
        let peer = CodexPeer()
        peer.thread.begin()
        peer.server.open()
        peer.thread.willSend(images: [URL(filePath: "/tmp/shot.png")])

        #expect(peer.thread.send("Look at this"))
        #expect(peer.thread.send("And now carry on"))

        #expect(peer.server.turns.first?["input"]?.array.count == 2)
        #expect(peer.server.turns.last?["input"]?.array.count == 1)
    }

    @Test
    func `an interrupt names the Turn in flight`() {
        let peer = CodexPeer()
        peer.thread.begin()
        peer.server.open(threadID: "thread-9")
        _ = peer.thread.send("Write me an essay")
        peer.server.started(turn: "turn-3")

        #expect(peer.thread.interrupt())

        let stop = peer.server.request("turn/interrupt")
        #expect(stop?.params.stringField("threadId") == "thread-9")
        #expect(stop?.params.stringField("turnId") == "turn-3")
    }

    /// Whether a Turn is running is a DERIVED reading, and the moment between reading it and
    /// clicking is exactly where a Turn ends on its own.
    @Test
    func `stopping a thread running nothing is silence rather than a refusal`() {
        let peer = CodexPeer()
        peer.thread.begin()
        peer.server.open()
        _ = peer.thread.send("Write me an essay")
        peer.server.started(turn: "turn-3")
        peer.server.completedTurn()

        #expect(peer.thread.interrupt())
        #expect(peer.server.request("turn/interrupt") == nil)
    }

    /// An approval becomes a prompt somebody can see, and NOTHING is answered until they answer it
    /// — the whole of what #549 changed. The server is left waiting on purpose: it keeps no clock,
    /// so the only clock over this call is Argo's own.
    @Test(arguments: [
        "item/commandExecution/requestApproval",
        "item/fileChange/requestApproval",
    ])
    func `an approval is raised as a Permission rather than answered for the user`(method: String) {
        let peer = CodexPeer()
        peer.thread.begin()
        peer.server.open()

        peer.server.ask(7, method: method, params: .object(["itemId": .string("exec-1")]))

        #expect(peer.readings.waiting.count == 1)
        #expect(peer.server.decision(7) == nil)
    }

    /// The server's third approval answers with a permission profile rather than a decision word,
    /// and Argo has no control that produces one — so it is refused like any other request this
    /// client cannot answer, rather than accepted in a shape guessed at.
    @Test
    func `the sandbox-widening approval is refused rather than raised`() {
        let peer = CodexPeer()
        peer.thread.begin()
        peer.server.open()

        peer.server.ask(8, method: "item/permissions/requestApproval")

        #expect(peer.readings.waiting.isEmpty)
        #expect(peer.server.answers.last?.result["message"] != nil)
    }

    @Test
    func `a server request this client cannot answer is refused rather than left open`() {
        let peer = CodexPeer()
        peer.thread.begin()
        peer.server.open()

        peer.server.ask(4, method: "item/tool/requestUserInput")

        #expect(peer.server.answers.last?.id == 4)
        #expect(peer.server.answers.last?.result["message"] != nil)
    }

    /// A handshake the server refuses is a thread that is never coming. Holding the Turns typed
    /// into that wait would read, from the user's side, exactly like a message swallowed — so the
    /// wait ends and everything after it is refused where the composer can say so.
    @Test
    func `a refused handshake refuses the Turns behind it rather than holding them`() {
        let peer = CodexPeer()
        peer.thread.begin()
        #expect(peer.thread.send("First thought"))
        let hello = peer.server.request("initialize")

        peer.server.refuse(hello?.id ?? 0)

        #expect(peer.server.turns.isEmpty)
        #expect(!peer.thread.send("Second thought"))
    }

    /// A rung is a property of the turn on this surface, so the change lands on the next one with
    /// nothing sent in between.
    @Test
    func `the rung the Session stands on rides on the next Turn`() {
        let peer = CodexPeer(cwd: "/work", mode: .code)
        peer.thread.begin()
        peer.server.open()

        peer.thread.setMode(.auto)
        #expect(peer.thread.send("Carry on"))

        #expect(peer.server.turns.last?.stringField("approvalPolicy") == "never")
        #expect(peer.server.turns.last?["sandboxPolicy"]?.stringField("type") == "dangerFullAccess")
    }

    private func text(of turn: JSONValue?) -> String? {
        turn?["input"]?.array.first?.stringField("text")
    }
}
