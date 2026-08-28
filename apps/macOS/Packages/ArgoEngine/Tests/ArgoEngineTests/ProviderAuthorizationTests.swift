@testable import ArgoEngine
import Foundation
import Testing

/// What the panel is told to show, per provider — the one fact the two grant flows differ in, in
/// the place a test can reach it rather than inside the app target (#371, ADR-0022).
@Suite("Provider authorization")
struct ProviderAuthorizationTests {
    @Test
    func `GitHub's grant is a code to type, and Argo does not take the window to show it`() {
        let asked = ProviderGrantInFlight.github(GitHubDeviceChallenge(
            userCode: "WDJB-MJHT",
            verificationURL: Self.deviceURL,
            deviceCode: "argo's own half",
            interval: .seconds(5),
            expiresIn: .seconds(900),
        ))

        let shown = asked.challenge

        #expect(shown.userCode == "WDJB-MJHT")
        // The address is short, fixed and part of the instruction. Opening it would take the
        // window while the user is still reading the code they have to bring.
        #expect(!shown.opensItself)
        #expect(shown.url == Self.deviceURL)
    }

    @Test
    func `Linear's grant is a page to approve, which Argo opens itself`() {
        let asked = ProviderGrantInFlight.linear(LinearAuthorizationRequest(
            authorizationURL: Self.authorizeURL,
            verifier: "argo's own half",
            state: "the-state",
        ))

        let shown = asked.challenge

        // No code, because the browser carries the whole exchange — a card offering one to copy
        // would be inventing a step of a flow that has none.
        #expect(shown.userCode == nil)
        #expect(shown.opensItself)
        #expect(shown.url == Self.authorizeURL)
    }

    @Test
    func `neither flow lets Argo's own half of the exchange reach a surface`() {
        // A device code and a PKCE verifier are both the secret pairing this wait with that
        // request, and a value that cannot carry one cannot show it.
        let shown = [
            ProviderGrantInFlight.github(GitHubDeviceChallenge(
                userCode: "WDJB-MJHT",
                verificationURL: Self.deviceURL,
                deviceCode: "secret",
                interval: .seconds(5),
                expiresIn: .seconds(900),
            )),
            .linear(LinearAuthorizationRequest(
                authorizationURL: Self.authorizeURL, verifier: "secret", state: "the-state",
            )),
        ].map(\.challenge)

        #expect(shown.allSatisfy { $0.userCode != "secret" })
    }

    private static let deviceURL = URL(string: "https://github.com/login/device")
        ?? .temporaryDirectory
    private static let authorizeURL = URL(string: "https://linear.app/oauth/authorize?x=1")
        ?? .temporaryDirectory
}
