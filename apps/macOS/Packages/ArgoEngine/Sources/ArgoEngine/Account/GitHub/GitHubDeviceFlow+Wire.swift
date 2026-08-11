import Foundation

/// GitHub's own JSON, parsed at the boundary into types whose required fields are exactly the ones
/// the flow cannot proceed without. Nothing inward re-checks what these produce.
extension GitHubDeviceFlow {
    static var decoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return decoder
    }

    struct DeviceCodeResponse: Decodable {
        let deviceCode: String
        let userCode: String
        let verificationUri: String
        let expiresIn: Int
        let interval: Int
    }

    /// The token endpoint answers one of two shapes at the same status code, told apart by which
    /// required field is present — which is why they are two models and not one with everything
    /// optional.
    struct TokenResponse: Decodable {
        let accessToken: String
        /// What GitHub actually granted, space-separated. An org policy can narrow it.
        let scope: String
    }

    struct TokenErrorResponse: Decodable {
        let error: String
        let errorDescription: String?
        /// Present on `slow_down`, where it is the interval GitHub is now asking for.
        let interval: Int?
    }

    struct UserResponse: Decodable {
        /// GitHub's numeric user id: the stable key an Account is held under, and the one thing on
        /// this response that a rename does not change.
        let id: Int
        let login: String
    }

    /// Where a poll stands. Only these three are non-terminal — every other `error` code the
    /// endpoint can return is a refusal, and is thrown rather than looped on.
    enum PollOutcome {
        case granted(AccountGrant)
        case pending
        /// Carries the interval GitHub asked for, absent where it named none.
        case slowDown(Duration?)
    }

    static func challenge(from data: Data) throws -> GitHubDeviceChallenge {
        guard let wire = try? decoder.decode(DeviceCodeResponse.self, from: data),
              let verificationURL = URL(string: wire.verificationUri)
        else { throw GitHubDeviceFlowError.malformedResponse }
        return GitHubDeviceChallenge(
            userCode: wire.userCode,
            verificationURL: verificationURL,
            deviceCode: wire.deviceCode,
            interval: .seconds(wire.interval),
            expiresIn: .seconds(wire.expiresIn),
        )
    }
}
