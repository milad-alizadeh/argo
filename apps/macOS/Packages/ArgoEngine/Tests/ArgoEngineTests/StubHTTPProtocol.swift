import Foundation

/// A `URLProtocol` that answers from the URL it was asked with, so a suite can name a status and a
/// header set and get exactly that back.
///
/// The reply is encoded in the query rather than held in a static, which is what keeps the stub
/// free of shared mutable state and every case independent of every other: `stub://x?status=403`
/// answers 403, and any other query item becomes a response header.
class StubHTTPProtocol: URLProtocol {
    static let scheme = "stub"

    /// A URL this protocol answers, carrying the status and the headers the case needs.
    static func url(status: Int, headers: [String: String] = [:]) -> String {
        let query = (["status": "\(status)"].merging(headers) { first, _ in first })
            .map { "\($0.key)=\($0.value)" }
            .joined(separator: "&")
        return "\(scheme)://provider/read?\(query)"
    }

    override class func canInit(with request: URLRequest) -> Bool {
        request.url?.scheme == scheme
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        guard let url = request.url,
              let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let response = Self.response(to: url, describedBy: parts.queryItems ?? [])
        else {
            client?.urlProtocol(self, didFailWithError: URLError(.badURL))
            return
        }
        let sent = request.value(forHTTPHeaderField: "If-None-Match") ?? ""
        // A host answers `304` to a validator it still recognises, and only where the case asked
        // for one: `validates=1` in the URL is a suite saying this endpoint offers that.
        if response.value(forHTTPHeaderField: "validates") == "1",
           sent == response.value(forHTTPHeaderField: "ETag"),
           let unchanged = Self.notModified(url) {
            client?.urlProtocol(self, didReceive: unchanged, cacheStoragePolicy: .notAllowed)
            client?.urlProtocolDidFinishLoading(self)
            return
        }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        // The body echoes the validator the request carried, which is the only way a suite behind
        // the transport seam can see whether one went out at all.
        // Escaped, because a real ETag is quoted — `W/"cafe"` — and unescaped it ends the string
        // it is being echoed inside.
        let echoed = sent.replacingOccurrences(of: "\"", with: "\\\"")
        client?.urlProtocol(self, didLoad: Data(#"{"ifNoneMatch":"\#(echoed)"}"#.utf8))
        client?.urlProtocolDidFinishLoading(self)
    }

    /// A bodiless `304`, which is what the status means: the last body still stands.
    private static func notModified(_ url: URL) -> HTTPURLResponse? {
        HTTPURLResponse(url: url, statusCode: 304, httpVersion: nil, headerFields: [:])
    }

    override func stopLoading() {}

    private static func response(
        to url: URL,
        describedBy items: [URLQueryItem],
    )
        -> HTTPURLResponse? {
        var headers: [String: String] = [:]
        var status = 200
        for item in items {
            guard let value = item.value else { continue }
            if item.name == "status" {
                status = Int(value) ?? status
            } else {
                headers[item.name] = value
            }
        }
        return HTTPURLResponse(
            url: url,
            statusCode: status,
            httpVersion: nil,
            headerFields: headers,
        )
    }
}

extension URLSession {
    /// A session that reaches `StubHTTPProtocol` and nothing else.
    static let stubbed: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubHTTPProtocol.self]
        return URLSession(configuration: configuration)
    }()
}
