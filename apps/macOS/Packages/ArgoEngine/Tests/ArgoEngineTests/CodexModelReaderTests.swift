@testable import ArgoEngine
import Foundation
import Testing

@Suite("Codex model choices")
@MainActor
struct CodexModelReaderTests {
    @Test func `catalog discovery creates no Session and follows every page`() async throws {
        let host = CatalogHost()
        let catalog = try await CodexModelReader(host: host).read(launch: Self.launch)
        #expect(catalog.models.map(\.id) == ["first", "second", "gpt-6-astra"])
        #expect(catalog.defaultRun == SessionRun(model: "second", effort: .ultra))
        #expect(catalog.resolve(SessionRun(model: "first", effort: .max))
            == SessionRun(model: "first", effort: .medium))
        #expect(catalog.resolve(SessionRun(model: "opus", effort: .high)) == catalog.defaultRun)
        #expect(host.process.methods == ["initialize", "initialized", "model/list", "model/list"])
        #expect(!host.process.isRunning)
    }

    @Test func `an unanswered catalog request times out and stops its process`() async throws {
        let host = CatalogHost()
        host.process.answers = false
        await #expect(throws: CodexModelReader.Failure.self) {
            try await CodexModelReader(host: host).read(launch: Self.launch, timeout: .zero)
        }
        #expect(!host.process.isRunning)
    }

    private static let launch = AgentLaunch(
        executablePath: "/unused",
        cwd: "/",
        arguments: ["app-server"],
    )
}

@MainActor
private final class CatalogHost: AgentProcessHost {
    let process = CatalogProcess()

    func start(_: AgentLaunch, events: AgentProcessEvents) -> AgentProcess {
        process.events = events
        return process
    }
}

@MainActor
private final class CatalogProcess: AgentProcess {
    var events: AgentProcessEvents?
    var isRunning = true
    var answers = true
    var methods: [String] = []

    func write(_ text: String) {
        guard let record = JSONValue.record(fromLine: text),
              let method = record.stringField("method") else { return }
        methods.append(method)
        guard answers, let id = record["id"]?.int else { return }
        let result: String
        switch method {
        case "initialize": result = "{}"
        case "model/list":
            let next = record["params"]?.stringField("cursor") != nil
            let model = next ? "second" : "first"
            let effort = next ? "ultra" : "medium"
            let cursor = next ? "null" : "\"next\""
            result = """
            {"data":[{"model":"\(model)","displayName":"\(model)","hidden":false,
            "isDefault":\(next),"defaultReasoningEffort":"\(effort)",
            "supportedReasoningEfforts":[{"reasoningEffort":"\(effort)"}]}],"nextCursor":\(cursor)}
            """
        default: result = "{}"
        }
        let response = "{\"id\":\(id),\"result\":\(result)}\n"
        guard let compact = JSONValue.record(fromLine: response)?.compactJSON else { return }
        events?.onData(Array((compact + "\n").utf8))
    }

    func resize(columns _: Int, rows _: Int) {}
    func terminate() {
        isRunning = false
    }
}
