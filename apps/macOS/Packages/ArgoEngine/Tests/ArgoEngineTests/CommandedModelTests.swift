@testable import ArgoEngine
import Foundation
import Testing

/// The model reading a `/model` command leaves behind (#1411).
///
/// `/model` is a LOCAL command: the CLI runs it itself and no assistant record follows it until
/// the next Turn opens. Between the two, the only thing in the file that knows the Session changed
/// model is the pair of records the command wrote — so that pair is read, and the footer stops
/// naming the model the Session has just left.
///
/// The reading is the command's ARGUMENT, released by the command's own output. Verbatim from
/// `claude` transcripts: `<command-args>opus</command-args>` on the first record, and
/// `Set model to `Opus 5` and saved as your default for new sessions` on the second.
@Suite("Commanded model")
struct CommandedModelTests {
    private func ids(_ events: [TranscriptEvent]) -> [String] {
        events.compactMap { event in
            guard case let .model(id) = event else { return nil }
            return id
        }
    }

    private func user(_ content: String, uuid: String) -> String {
        let escaped = content
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\u{1B}", with: "\\u001b")
        return """
        {"type": "user", "message": {"role": "user", "content": "\(escaped)"}, \
        "uuid": "\(uuid)", "cwd": "/tmp/argo", "sessionId": "s"}
        """
    }

    private func invoked(_ name: String, _ args: String, uuid: String = "c") -> String {
        user(
            "<command-name>\(name)</command-name>\n<command-message>x</command-message>\n"
                + "<command-args>\(args)</command-args>",
            uuid: uuid,
        )
    }

    private func printed(_ text: String, uuid: String = "o") -> String {
        user("<local-command-stdout>\(text)</local-command-stdout>", uuid: uuid)
    }

    private func answered(model: String, uuid: String) -> String {
        """
        {"type": "assistant", "message": {"role": "assistant", "model": "\(model)", \
        "content": [{"type": "text", "text": "hi"}]}, "uuid": "\(uuid)", \
        "cwd": "/tmp/argo", "sessionId": "s"}
        """
    }

    /// The set the CLI confirmed, in the CLI's own alias — which is what `--model` takes when the
    /// chain is resumed, and what `ReadableModelName` says as `Opus 5`.
    @Test
    func `an argument the command's output confirmed is the reading`() async {
        let reader = TranscriptReader()
        let lines = [
            invoked("/model", "opus"),
            printed("Set model to `Opus 5` and saved as your default for new sessions"),
        ]

        let read = await ids(reader.read(lines: lines))

        #expect(read == ["opus"])
    }

    /// What the older CLI printed, and what a picker that closed on the model the Session was
    /// already on prints. Both state the same fact the backticked sentence does.
    @Test(arguments: ["Set model to opus", "Kept model as \u{1B}[1mOpus 5\u{1B}[22m"])
    func `every sentence the command prints on a set releases the argument`(text: String) async {
        let reader = TranscriptReader()

        let read = await ids(reader.read(lines: [invoked("/model", "opus"), printed(text)]))

        #expect(read == ["opus"])
    }

    /// The tier rule, and the whole reason the argument waits for the output: a `/model` the CLI
    /// refused prints no such sentence, so the footer never runs ahead of the Session.
    @Test
    func `an argument no output confirmed is never the reading`() async {
        let reader = TranscriptReader()
        let lines = [
            invoked("/model", "nonesuch"),
            printed("Unknown model: nonesuch"),
        ]

        let read = await ids(reader.read(lines: lines))

        #expect(read.isEmpty)
    }

    /// And the ask is not held across the file. Two records the CLI writes together are the only
    /// pair that means anything; a sentence arriving after something else is a sentence about
    /// something else.
    @Test
    func `an ask is dropped by the record between it and the output`() async {
        let reader = TranscriptReader()
        let lines = [
            invoked("/model", "opus"),
            user("what do you make of this", uuid: "p"),
            printed("Set model to `Opus 5` and saved as your default for new sessions"),
        ]

        let read = await ids(reader.read(lines: lines))

        #expect(read.isEmpty)
    }

    /// The same, for a Turn between the two. A record carrying content is something the CLI came
    /// back to, so the ask that was waiting on the command's own output is gone.
    @Test
    func `an ask is dropped by a Turn between it and the output`() async {
        let reader = TranscriptReader()
        let lines = [
            invoked("/model", "opus"),
            answered(model: "claude-sonnet-5", uuid: "a1"),
            printed("Set model to `Opus 5` and saved as your default for new sessions"),
        ]

        let read = await ids(reader.read(lines: lines))

        #expect(read == ["claude-sonnet-5"])
    }

    /// And by a gap. A bounded read must not join two records the file never put together — what
    /// the gap swallowed is not the record the ask was waiting for.
    @Test
    func `an ask is dropped by the gap a bounded read leaves`() async {
        let reader = TranscriptReader()
        let text = "Set model to `Opus 5` and saved as your default for new sessions"

        _ = await reader.read(TranscriptLine(text: invoked("/model", "opus"), byteOffset: 0))
        let read = await ids(reader.read(
            TranscriptLine(text: printed(text), byteOffset: 400, followsGap: true),
        ))

        #expect(read.isEmpty)
    }

    /// A set sentence with no `/model` in front of it names nothing to read — `/status` and the
    /// rest print their own lines, and only the command's own argument says a model.
    @Test
    func `an output with no ask in front of it announces nothing`() async {
        let text = "Set model to `Opus 5` and saved as your default for new sessions"

        let read = await ids(TranscriptReader().read(line: printed(text)))

        #expect(read.isEmpty)
    }

    @Test
    func `a bare model command asks for nothing and announces nothing`() async {
        let reader = TranscriptReader()
        let lines = [
            invoked("/model", ""),
            printed("Kept model as \u{1B}[1mOpus 5\u{1B}[22m"),
        ]

        let read = await ids(reader.read(lines: lines))

        #expect(read.isEmpty)
    }

    /// Another command's argument is not a model, whatever its output says.
    @Test
    func `another command's argument is never read as a model`() async {
        let reader = TranscriptReader()
        let lines = [
            invoked("/effort", "xhigh"),
            printed("Set model to `Opus 5` and saved as your default for new sessions"),
        ]

        let read = await ids(reader.read(lines: lines))

        #expect(read.isEmpty)
    }

    /// The reading the command has to survive into: a Turn opened after it reports the id the
    /// provider answered on, which is the same model said the provider's way.
    @Test
    func `the id the next Turn reports supersedes the command's argument`() async {
        let reader = TranscriptReader()
        let lines = [
            answered(model: "claude-sonnet-5", uuid: "a1"),
            invoked("/model", "opus"),
            printed("Set model to `Opus 5` and saved as your default for new sessions"),
            answered(model: "claude-opus-5", uuid: "a2"),
        ]

        let read = await ids(reader.read(lines: lines))

        #expect(read == ["claude-sonnet-5", "opus", "claude-opus-5"])
    }

    /// And it is announced ONCE. The pair is two records like any others, so a reader passing over
    /// the same file twice must not re-state what it already said.
    @Test
    func `the same command run twice announces once`() async {
        let reader = TranscriptReader()
        let text = "Set model to `Opus 5` and saved as your default for new sessions"
        let lines = [
            invoked("/model", "opus", uuid: "c1"),
            printed(text, uuid: "o1"),
            invoked("/model", "opus", uuid: "c2"),
            printed(text, uuid: "o2"),
        ]

        let read = await ids(reader.read(lines: lines))

        #expect(read == ["opus"])
    }
}
