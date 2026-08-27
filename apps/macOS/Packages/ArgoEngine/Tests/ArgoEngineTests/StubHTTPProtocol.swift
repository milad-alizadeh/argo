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
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: Data("{}".utf8))
        client?.urlProtocolDidFinishLoading(self)
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
