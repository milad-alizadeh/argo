import Foundation

/// Reads the models available to an Anthropic API account without submitting a Turn.
@MainActor
final class ClaudeModelReader {
    private let environment: [String: String]
    private let session: URLSession

    init(
        environment: [String: String] = ProcessInfo.processInfo.environment,
        session: URLSession = .shared,
    ) {
        self.environment = environment
        self.session = session
    }

    func read() async throws -> SessionRunCatalog {
        var models: [SessionRunCatalog.Model] = []
        var cursor: String?
        var seen: Set<String> = []
        repeat {
            let page = try await page(after: cursor)
            models += page.models.filter { next in !models.contains { $0.id == next.id } }
            guard page.hasMore else { break }
            guard let next = page.lastID, seen.insert(next).inserted else {
                throw Failure.unavailable
            }
            cursor = next
        } while true
        guard !models.isEmpty else {
            throw Failure.unavailable
        }
        return SessionRunCatalog(models: models)
    }

    private func page(after cursor: String?) async throws -> ClaudeModelPage {
        guard let baseURL else { throw Failure.unavailable }
        var components = URLComponents(
            url: baseURL.appending(path: "v1/models"),
            resolvingAgainstBaseURL: false,
        )
        if let cursor {
            components?.queryItems = [URLQueryItem(name: "after_id", value: cursor)]
        }
        guard let url = components?.url else { throw Failure.unavailable }
        var request = URLRequest(url: url, timeoutInterval: 5)
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        if let key = environment["ANTHROPIC_API_KEY"], !key.isEmpty {
            request.setValue(key, forHTTPHeaderField: "x-api-key")
        } else if let token = environment["ANTHROPIC_AUTH_TOKEN"], !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        } else {
            throw Failure.noCredential
        }
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse,
              (200 ..< 300).contains(response.statusCode),
              let page = try? JSONDecoder().decode(ClaudeModelPage.self, from: data)
        else { throw Failure.unavailable }
        return page
    }

    private var baseURL: URL? {
        environment["ANTHROPIC_BASE_URL"].flatMap(URL.init(string:))
            ?? URL(string: "https://api.anthropic.com")
    }

    enum Failure: Error {
        case noCredential
        case unavailable
    }
}
