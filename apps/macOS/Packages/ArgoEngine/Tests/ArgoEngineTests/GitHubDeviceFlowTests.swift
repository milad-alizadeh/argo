@testable import ArgoEngine
import Foundation
import Testing

/// The grant, driven against recorded GitHub responses. The network is replaced and the wait is
/// replaced; everything between them — what is shown, when it gives up, what it records — is real.
@Suite("GitHub device flow")
struct GitHubDeviceFlowTests {
    @Test
    func `the code and the URL are in hand before anything waits`() async throws {
        let github = StubGitHub(responses: [.deviceCode])
        let flow = GitHubDeviceFlow(transport: github, sleep: github.sleep)

        let challenge = try await flow.requestChallenge()

        #expect(challenge.userCode == "WDJB-MJHT")
        #expect(challenge.verificationURL.absoluteString == "https://github.com/login/device")
        #expect(await github.waits().isEmpty)
    }

    @Test
    func `the requested scope carries GitHub Projects alongside repo`() async throws {
        let github = StubGitHub(responses: [.deviceCode])

        _ = try await GitHubDeviceFlow(transport: github, sleep: github.sleep).requestChallenge()

        #expect(await github.forms().first?["scope"] == "repo read:project")
    }

    @Test
    func `a pending authorization keeps polling until the user finishes`() async throws {
        let github = StubGitHub(responses: [.pending, .pending, .token])
        let flow = GitHubDeviceFlow(transport: github, sleep: github.sleep)

        let grant = try await flow.awaitGrant(for: .stub())

        #expect(grant.accessToken == "ghu_granted")
    }

    /// What was granted, not what was asked for: an org restricting the OAuth App narrows the set,
    /// and the record has to say so rather than repeat the request back.
    @Test
    func `the grant records the scope GitHub actually returned`() async throws {
        let github = StubGitHub(responses: [.token])

        let grant = try await GitHubDeviceFlow(transport: github, sleep: github.sleep)
            .awaitGrant(for: .stub())

        #expect(grant.scopes == ["repo"])
    }

    /// GitHub names the interval it now wants in the same body, and that number wins: adding a
    /// fixed step to the old one would keep polling faster than the provider just asked for.
    @Test
    func `a slow_down polls at the interval GitHub asked for`() async throws {
        let github = StubGitHub(responses: [.slowDown, .token])
        let flow = GitHubDeviceFlow(transport: github, sleep: github.sleep)

        _ = try await flow.awaitGrant(for: .stub())

        #expect(await github.waits() == [.seconds(5), .seconds(20)])
    }

    @Test
    func `a slow_down naming no interval falls back to the documented step`() async throws {
        let github = StubGitHub(responses: [.slowDownBare, .token])
        let flow = GitHubDeviceFlow(transport: github, sleep: github.sleep)

        _ = try await flow.awaitGrant(for: .stub())

        #expect(await github.waits() == [.seconds(5), .seconds(10)])
    }

    @Test
    func `a user who declines on GitHub's screen ends the grant`() async throws {
        let github = StubGitHub(responses: [.declined])
        let flow = GitHubDeviceFlow(transport: github, sleep: github.sleep)

        await #expect(throws: GitHubDeviceFlowError.declined) {
            try await flow.awaitGrant(for: .stub())
        }
    }

    @Test
    func `a code left unentered expires rather than polling forever`() async throws {
        let github = StubGitHub(responses: Array(repeating: .pending, count: 20))
        let flow = GitHubDeviceFlow(transport: github, sleep: github.sleep)

        await #expect(throws: GitHubDeviceFlowError.expired) {
            try await flow.awaitGrant(for: .stub(expiresIn: .seconds(15)))
        }
        #expect(await github.waits().count == 3)
    }

    /// An org's OAuth-App policy arrives as a refusal Argo has never seen before, and its own words
    /// are the only thing that says what to do about it.
    @Test
    func `a refusal Argo does not recognise keeps GitHub's own words`() async throws {
        let github = StubGitHub(responses: [.refused])
        let flow = GitHubDeviceFlow(transport: github, sleep: github.sleep)

        await #expect(throws: GitHubDeviceFlowError.refused(
            code: "device_flow_disabled",
            description: "Device flow is not enabled for this app",
        )) {
            try await flow.awaitGrant(for: .stub())
        }
    }

    @Test
    func `an answer that is not the documented shape is not guessed past`() async throws {
        let github = StubGitHub(responses: [.nonsense])
        let flow = GitHubDeviceFlow(transport: github, sleep: github.sleep)

        await #expect(throws: GitHubDeviceFlowError.malformedResponse) {
            try await flow.requestChallenge()
        }
    }

    @Test
    func `the identity is keyed on GitHub's numeric id, not the login`() async throws {
        let github = StubGitHub(responses: [.user])
        let flow = GitHubDeviceFlow(transport: github, sleep: github.sleep)

        let account = try await flow.identity(with: AccountGrant(accessToken: "t", scopes: []))

        #expect(account.id == "github:583231")
        #expect(account.displayName == "octocat")
    }

    /// A revoked grant is the Account-level failure, and its recovery is authorizing again. Reading
    /// it as "GitHub said something undocumented" would send the user looking for a bug instead.
    @Test
    func `a revoked token reads as refused, not as a malformed answer`() async throws {
        let github = StubGitHub(responses: [.revoked])
        let flow = GitHubDeviceFlow(transport: github, sleep: github.sleep)

        await #expect(throws: HTTPTransportError.unauthorized(code: 401)) {
            try await flow.identity(with: AccountGrant(accessToken: "ghu_revoked", scopes: []))
        }
    }

    @Test
    func `the identity is read as the Account, not as Argo`() async throws {
        let github = StubGitHub(responses: [.user])
        let flow = GitHubDeviceFlow(transport: github, sleep: github.sleep)

        _ = try await flow.identity(with: AccountGrant(accessToken: "ghu_bearer", scopes: []))

        #expect(await github.bearerTokens() == ["ghu_bearer"])
    }
}
