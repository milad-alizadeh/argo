@testable import ArgoEngine
import Testing

/// "Connect GitHub", end to end: the grant completes and the machine has an Account it did not
/// have before, held under the id GitHub returned rather than anything the user typed.
@Suite("GitHub authorization")
struct GitHubAuthorizationTests {
    @Test
    func `completing the device flow creates the Account`() async throws {
        let fixture = try AccountFixture()
        defer { fixture.remove() }
        let github = StubGitHub(responses: [.deviceCode, .pending, .token, .user])
        let store = fixture.store()
        let authorization = GitHubAuthorization(
            flow: GitHubDeviceFlow(transport: github, sleep: github.sleep),
            accounts: store,
        )

        let challenge = try await authorization.begin()
        let account = try await authorization.complete(challenge)

        #expect(challenge.userCode == "WDJB-MJHT")
        #expect(account.id == "github:583231")
        #expect(await store.load().accounts.map(\.displayName) == ["octocat"])
    }

    @Test
    func `the Account created reads with the token the grant returned`() async throws {
        let fixture = try AccountFixture()
        defer { fixture.remove() }
        let github = StubGitHub(responses: [.deviceCode, .token, .user])
        let store = fixture.store()
        let authorization = GitHubAuthorization(
            flow: GitHubDeviceFlow(transport: github, sleep: github.sleep),
            accounts: store,
        )

        _ = try await authorization.complete(authorization.begin())

        #expect(try await store.grant(for: "github:583231")?.accessToken == "ghu_granted")
    }

    /// A grant that never completes records nothing: an Account is what a *finished* grant makes,
    /// and a half-authorized row would render as connected while reading nothing.
    @Test
    func `a declined grant creates no Account`() async throws {
        let fixture = try AccountFixture()
        defer { fixture.remove() }
        let github = StubGitHub(responses: [.deviceCode, .declined])
        let store = fixture.store()
        let authorization = GitHubAuthorization(
            flow: GitHubDeviceFlow(transport: github, sleep: github.sleep),
            accounts: store,
        )
        let challenge = try await authorization.begin()

        await #expect(throws: GitHubDeviceFlowError.declined) {
            try await authorization.complete(challenge)
        }
        #expect(await store.load().accounts.isEmpty)
    }
}
