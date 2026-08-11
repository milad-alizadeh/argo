import Foundation

/// The real transport: `URLSession`, asking every provider for JSON.
///
/// GitHub's OAuth endpoints answer form-encoded unless `Accept: application/json` is set, and its
/// API refuses a request with no `User-Agent` outright — both are provider contract, not defaults.
public struct URLSessionTransport: HTTPTransport {
    private let session: URLSession
    private let userAgent: String

    public init(session: URLSession = .shared, userAgent: String = "Argo") {
        self.session = session
        self.userAgent = userAgent
    }

    public func send(_ request: HTTPRequest) async throws -> Data {
        let (data, response) = try await session.data(for: urlRequest(request))
        guard let http = response as? HTTPURLResponse else { return data }
        // A refused token is its own answer and never a body worth parsing: read as data it would
        // surface as "the provider said something undocumented", which is the wrong diagnosis for
        // the likeliest real failure there is — a grant that has been revoked.
        if http.statusCode == 401 || http.statusCode == 403 {
            throw HTTPTransportError.unauthorized(code: http.statusCode)
        }
        // Every other 4xx carries the provider's own error body, which says more than the code
        // does — the device flow's "authorization_pending" arrives as one and is not a failure at
        // all. Only a 5xx has nothing in it to read.
        if http.statusCode >= 500 {
            throw HTTPTransportError.status(code: http.statusCode)
        }
        return data
    }

    private func urlRequest(_ request: HTTPRequest) throws -> URLRequest {
        guard let url = URL(string: request.url) else {
            throw HTTPTransportError.malformedURL(request.url)
        }
        var urlRequest = URLRequest(url: url)
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")
        urlRequest.setValue(userAgent, forHTTPHeaderField: "User-Agent")
        if let token = request.bearerToken {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        guard let body = request.body else { return urlRequest }
        urlRequest.httpMethod = "POST"
        switch body {
        case let .form(fields):
            urlRequest.setValue(
                "application/x-www-form-urlencoded",
                forHTTPHeaderField: "Content-Type",
            )
            urlRequest.httpBody = Data(Self.encoded(fields).utf8)
        case let .json(data):
            urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
            urlRequest.httpBody = data
        }
        return urlRequest
    }

    /// Sorted so one request encodes to one body, which is what makes a recorded response in a
    /// test addressable by what was asked rather than by the order a dictionary happened to yield.
    private static func encoded(_ form: [String: String]) -> String {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        return form.keys.sorted().map { key in
            let value = form[key] ?? ""
            let escaped = value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
            return "\(key)=\(escaped)"
        }.joined(separator: "&")
    }
}
