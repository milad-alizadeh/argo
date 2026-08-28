import Foundation

/// One GraphQL operation put to Linear, and the one place its refusal is read.
///
/// The sibling of `GitHubCall`, and the whole of the difference between the two providers'
/// plumbing: GitHub names a path per read and answers a refusal with a status, Linear names one
/// endpoint and answers a refusal with a 200 whose body carries `errors`.
struct LinearCall: Sendable {
    let transport: HTTPTransport

    /// The `data` payload of one operation, or why there is not one.
    ///
    /// `errors` is read BEFORE the payload is: a partial answer carrying both is Linear having
    /// refused part of what was asked, and adopting the half that came back would be a fact
    /// nobody's grant established.
    func payload<Payload: Decodable>(
        _ operation: LinearOperation, grant: AccountGrant,
    ) async throws(LinearFailure)
        -> Payload {
        let reply: LinearReply<Payload> = try await answer(operation, grant: grant)
        if let refusal = reply.refusal {
            throw LinearFailure.refused(refusal)
        }
        guard let data = reply.data else { throw LinearFailure.unreadable }
        return data
    }

    private func answer<Payload: Decodable>(
        _ operation: LinearOperation, grant: AccountGrant,
    ) async throws(LinearFailure)
        -> LinearReply<Payload> {
        guard let body = try? JSONEncoder().encode(operation) else {
            throw LinearFailure.unreadable
        }
        let request = HTTPRequest(
            url: LinearAPI.endpoint, body: .json(body), bearerToken: grant.accessToken,
        )
        let data: Data
        do {
            data = try await transport.send(request)
        } catch {
            throw LinearFailure.sending(error)
        }
        guard let reply = try? LinearAPI.decoder.decode(
            LinearReply<Payload>.self, from: data,
        ) else {
            throw LinearFailure.unreadable
        }
        return reply
    }
}
