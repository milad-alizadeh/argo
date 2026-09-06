@testable import ArgoEngine
import Foundation
import Testing

/// Reading who Codex is signed in as, and refusing in each way it can be absent (#1315).
@Suite("Codex sign-in")
struct CodexSignInTests {
    @Test
    func `a ChatGPT sign-in reads its address and its plan`() throws {
        let home = try TemporaryCodexHome(auth: TemporaryCodexHome.chatGPT)
        defer { home.remove() }

        let signIn = try CodexSignInReader.read(in: home.url)

        #expect(signIn.email == "reader@example.com")
        #expect(signIn.plan == "plus")
    }

    @Test
    func `no auth file refuses rather than answering nothing`() throws {
        let home = try TemporaryCodexHome(auth: nil)
        defer { home.remove() }

        #expect(throws: BacklogAskRefusal.self) {
            try CodexSignInReader.read(in: home.url)
        }
    }

    /// The refusal this port exists for: an API-key sign-in would answer, and every token would be
    /// metered.
    @Test
    func `an API key sign-in is refused as not a ChatGPT one`() throws {
        let home = try TemporaryCodexHome(auth: #"{"OPENAI_API_KEY": "sk-live"}"#)
        defer { home.remove() }

        let refusal = refusal(reading: home)

        #expect(refusal?.sentence.contains("API key") == true)
    }

    /// The ambiguous file, which the tokens check alone would have passed. Which credential Codex
    /// would spend is its choice, so the only answer that cannot be wrong is to refuse.
    @Test
    func `a file holding both a key and tokens is refused`() throws {
        let signedIn = TemporaryCodexHome.chatGPT
        let both = signedIn.replacingOccurrences(
            of: "{\"tokens\"", with: "{\"OPENAI_API_KEY\": \"sk-live\", \"tokens\"",
        )
        let home = try TemporaryCodexHome(auth: both)
        defer { home.remove() }

        let refusal = refusal(reading: home)

        #expect(refusal?.sentence.contains("billed per token") == true)
    }

    /// The null the CLI actually writes beside a ChatGPT sign-in is not a key, and a check reading
    /// it as one would refuse every signed-in Mac.
    @Test
    func `a null key beside a sign-in is not treated as a key`() throws {
        let withNull = TemporaryCodexHome.chatGPT.replacingOccurrences(
            of: "{\"tokens\"", with: "{\"OPENAI_API_KEY\": null, \"tokens\"",
        )
        let home = try TemporaryCodexHome(auth: withNull)
        defer { home.remove() }

        let signIn = try CodexSignInReader.read(in: home.url)

        #expect(signIn.email == "reader@example.com")
    }

    /// A ChatGPT sign-in whose token names no plan still pays on included tokens — the credential
    /// is the fact, and the plan is an attribution that goes quiet.
    @Test
    func `a token naming no plan still answers, with no plan stated`() throws {
        let home = try TemporaryCodexHome(auth: TemporaryCodexHome.auth(claims: [
            "email": "reader@example.com",
        ]))
        defer { home.remove() }

        let signIn = try CodexSignInReader.read(in: home.url)

        #expect(signIn.email == "reader@example.com")
        #expect(signIn.plan == nil)
    }

    @Test
    func `a token naming nobody is refused`() throws {
        let home = try TemporaryCodexHome(auth: #"{"tokens": {"id_token": "a.b.c"}}"#)
        defer { home.remove() }

        let refusal = refusal(reading: home)

        #expect(refusal?.sentence.contains("names nobody") == true)
    }

    @Test
    func `CODEX_HOME names where the sign-in is read from`() {
        let named = CodexSignInReader.home(["CODEX_HOME": "/somewhere/else"])
        let absent = CodexSignInReader.home([:])

        #expect(named.path == "/somewhere/else")
        #expect(absent.path.hasSuffix("/.codex"))
    }

    private func refusal(reading home: TemporaryCodexHome) -> BacklogAskRefusal? {
        do {
            _ = try CodexSignInReader.read(in: home.url)
            return nil
        } catch {
            return error
        }
    }
}

/// A `CODEX_HOME` holding whatever `auth.json` a case needs, including none.
struct TemporaryCodexHome {
    let url: URL

    init(auth: String?) throws {
        self.url = FileManager.default.temporaryDirectory
            .appending(path: "argo-codex-home-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        if let auth {
            try auth.write(to: url.appending(path: "auth.json"), atomically: true, encoding: .utf8)
        }
    }

    func remove() {
        try? FileManager.default.removeItem(at: url)
    }

    /// The plan sits INSIDE the namespaced object, which is how OpenAI's own token spells it.
    static let chatGPT = auth(claims: [
        "email": "reader@example.com",
        "https://api.openai.com/auth": ["chatgpt_plan_type": "plus"],
    ])

    /// An `auth.json` around an unsigned token carrying those claims. The signature is a literal
    /// because nothing verifies it — the payload is read as an attribution, never as access.
    static func auth(claims: [String: Any]) -> String {
        let payload = try? JSONSerialization.data(withJSONObject: claims)
        let encoded = payload?.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "") ?? ""
        return #"{"tokens": {"id_token": "header.\#(encoded).signature"}}"#
    }
}
