import Foundation

/// Queries the catalog without creating a thread or submitting a Turn.
@MainActor
public final class CodexModelReader {
    private let host: AgentProcessHost
    private var process: AgentProcess?
    private var lines = CodexLineBuffer()
    private var reply: CheckedContinuation<SessionRunCatalog, Error>?
    private var models: [SessionRunCatalog.Model] = []
    private var requestID = 1
    private var cursors: Set<String> = []

    public convenience init() {
        self.init(host: CodexProcessHost())
    }

    init(host: AgentProcessHost) {
        self.host = host
    }

    public func read(launcher: AgentLauncher, cwd: String) async throws -> SessionRunCatalog {
        let launch = try await launcher.launch(cli: .codex, cwd: cwd, companion: nil)
        return try await read(launch: launch.adding(["app-server"]))
    }

    func read(
        launch: AgentLaunch,
        timeout: Duration = .seconds(10),
    ) async throws
        -> SessionRunCatalog {
        guard reply == nil else { throw Failure.unavailable }
        try Task.checkCancellation()
        lines = CodexLineBuffer()
        models = []
        cursors = []
        requestID = 1
        return try await withTaskCancellationHandler {
            let clock = Task {
                do {
                    try await Task.sleep(for: timeout)
                    finish(.failure(Failure.unavailable))
                } catch {}
            }
            defer { clock.cancel() }
            return try await withCheckedThrowingContinuation { continuation in
                reply = continuation
                do {
                    process = try host.start(launch, events: AgentProcessEvents(
                        onData: { [weak self] in self?.received($0) },
                        onExit: { [weak self] _ in self?.finish(.failure(Failure.unavailable)) },
                    ))
                    send(CodexRPC.request(id: requestID, method: "initialize", params: [
                        "clientInfo": .object([
                            "name": .string(CodexClient.name),
                            "version": .string(CodexClient.version),
                        ]),
                    ]))
                } catch {
                    finish(.failure(error))
                }
            }
        } onCancel: {
            Task { @MainActor in self.finish(.failure(CancellationError())) }
        }
    }

    private func received(_ bytes: [UInt8]) {
        for line in lines.take(bytes) {
            guard reply != nil, let message = CodexServerMessage(line: line) else { continue }
            switch message {
            case let .answer(id, result) where id == requestID:
                answered(result)
            case let .failure(id) where id == requestID:
                finish(.failure(Failure.unavailable))
            case let .request(id, method, _):
                send(CodexRPC.unsupported(id: id, method: method))
            case .answer, .failure, .notification: break
            }
        }
    }

    private func answered(_ result: JSONValue) {
        if requestID == 1 {
            send(CodexRPC.notification("initialized"))
            return list(cursor: nil)
        }
        guard let json = result.compactJSON,
              let page = try? JSONDecoder().decode(CodexModelPage.self, from: Data(json.utf8))
        else { return finish(.failure(Failure.unavailable)) }
        models += page.models.filter { next in !models.contains { $0.id == next.id } }
        guard let cursor = page.nextCursor else {
            guard !models.isEmpty else { return finish(.failure(Failure.unavailable)) }
            return finish(.success(SessionRunCatalog(models: models)))
        }
        guard cursors.insert(cursor).inserted else { return finish(.failure(Failure.unavailable)) }
        list(cursor: cursor)
    }

    private func list(cursor: String?) {
        requestID += 1
        var params: [String: JSONValue] = [:]
        if let cursor {
            params["cursor"] = .string(cursor)
        }
        send(CodexRPC.request(id: requestID, method: "model/list", params: params))
    }

    private func send(_ line: String?) {
        guard let line, let process, process.isRunning else {
            return finish(.failure(Failure.unavailable))
        }
        process.write(line)
    }

    private func finish(_ result: Result<SessionRunCatalog, Error>) {
        guard let continuation = reply else { return }
        reply = nil
        let finished = process
        process = nil
        finished?.terminate()
        continuation.resume(with: result)
    }

    enum Failure: LocalizedError {
        case unavailable

        var errorDescription: String? {
            "Could not load Codex models. Try again."
        }
    }
}
