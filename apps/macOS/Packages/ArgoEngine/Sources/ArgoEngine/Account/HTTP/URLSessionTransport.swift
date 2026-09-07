import Foundation

/// The real transport: `URLSession`, asking every provider for JSON.
///
/// GitHub's OAuth endpoints answer form-encoded unless `Accept: application/json` is set, and its
/// API refuses a request with no `User-Agent` outright — both are provider contract, not defaults.
public struct URLSessionTransport: HTTPTransport {
    private let session: URLSession
    private let userAgent: String
    /// Per instance, and every adapter builds its own: an adapter asks its own set of URLs, and a
    /// process-wide store would be shared mutable state for no saving.
    private let etags = ETagLedger()

    public init(session: URLSession = .shared, userAgent: String = "Argo") {
        self.session = session
        self.userAgent = userAgent
    }

    public func send(_ request: HTTPRequest) async throws -> Data {
        // Sent unconditionally whatever the request asked for: a caller reading `Data` has no way
        // to act on "unchanged", so it must not be offered one.
        guard case let .answered(data) = try await fetch(request.revalidated(false)) else {
            throw HTTPTransportError.status(code: 304)
        }
        return data
    }

    public func fetch(_ request: HTTPRequest) async throws -> HTTPReply {
        let validator = request.revalidating ? await etags.validator(for: request.url) : nil
        let (data, response) = try await session.data(
            for: urlRequest(request, ifNoneMatch: validator),
        )
        guard let http = response as? HTTPURLResponse else { return .answered(data) }
        // Asked BEFORE the refusal, because GitHub throttles with the same 403 it refuses a token
        // with: `x-ratelimit-remaining: 0` on a primary limit, `retry-after` on a secondary one,
        // and 429 for either. Nothing behind this seam sees a header, so this is the only place the
        // two can still be told apart.
        if Self.isThrottled(http) {
            throw HTTPTransportError.rateLimited
        }
        // Raised rather than handed on: read as data a refusal would surface as an undocumented
        // reply rather than as the refusal it is. Its sentence travels with it, because a 403 is
        // also how GitHub declines a write the token may not make.
        if http.statusCode == 401 || http.statusCode == 403 {
            throw HTTPTransportError.unauthorized(
                code: http.statusCode, reason: Self.reason(in: data),
            )
        }
        // Answered before the ledger is touched, and the validator is left where it is: a 304
        // carries no body and, per RFC 9110, need carry no `ETag` either — recording its absence
        // would throw away the only thing that makes the NEXT tick free.
        if validator != nil, http.statusCode == 304 {
            return .unchanged
        }
        // Every other 4xx carries the provider's own error body, which says more than the code
        // does — the device flow's "authorization_pending" arrives as one and is not a failure at
        // all. Only a 5xx has nothing in it to read.
        if http.statusCode >= 500 {
            throw HTTPTransportError.status(code: http.statusCode)
        }
        // Only what a later ask can be validated AGAINST: a 4xx body is an error the caller reads
        // once, and holding its `ETag` would let a `Not Found` validate itself forever.
        if request.revalidating, (200 ..< 300).contains(http.statusCode) {
            await etags.record(http.value(forHTTPHeaderField: "ETag"), for: request.url)
        }
        return .answered(data)
    }

    /// The provider's own sentence about the refusal, and `nil` where it wrote none.
    private static func reason(in data: Data) -> String? {
        struct Refusal: Decodable { let message: String }
        return (try? JSONDecoder().decode(Refusal.self, from: data))?.message
    }

    /// A 429 is always a limit. A 403 is one only where the headers say so, and a 403 with a budget
    /// still on it is a genuine refusal.
    private static func isThrottled(_ response: HTTPURLResponse) -> Bool {
        if response.statusCode == 429 {
            return true
        }
        guard response.statusCode == 403 else { return false }
        let header = response.value(forHTTPHeaderField:)
        return header("x-ratelimit-remaining") == "0" || header("retry-after") != nil
    }

    private func urlRequest(
        _ request: HTTPRequest, ifNoneMatch validator: String?,
    ) throws
        -> URLRequest {
        guard let url = URL(string: request.url) else {
            throw HTTPTransportError.malformedURL(request.url)
        }
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = request.method.rawValue
        urlRequest.setValue("application/json", forHTTPHeaderField: "Accept")
        urlRequest.setValue(userAgent, forHTTPHeaderField: "User-Agent")
        if let validator {
            urlRequest.setValue(validator, forHTTPHeaderField: "If-None-Match")
            // URLSession's own cache would answer a conditional read from disk without asking the
            // host, which is the one thing that would make a 304 unobservable here.
            urlRequest.cachePolicy = .reloadIgnoringLocalCacheData
        }
        if let token = request.bearerToken {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        guard let body = request.body else { return urlRequest }
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
