import Foundation

/// Who the Codex CLI is signed in as, and on what plan — the identity an answer is attributed to.
///
/// **DERIVED, not an `AccountRecord`** (`CONTEXT.md` L2 · Honesty tier). Argo's Accounts are grants
/// Argo itself issued and holds in the keychain, and Codex's sign-in is neither: it belongs to the
/// CLI, lives in `CODEX_HOME/auth.json`, and Argo only reads it. Modelling it as an Account would
/// render a DIRECT claim over a fact Argo cannot vouch for.
///
/// **The credential is what says included rather than metered, not the plan.** Verified against
/// `codex-cli` 0.147.0 on 2026-09-05: an `OPENAI_API_KEY` sign-in writes that key at the file's top
/// level and no `tokens`, and a ChatGPT sign-in writes `tokens` and leaves the key null. That
/// presence is the fact the refusal rests on; the plan below is drawn beside the answer and decides
/// nothing.
public struct CodexSignIn: Equatable, Sendable {
    /// The address on the ChatGPT identity, for the attribution line.
    public let email: String
    /// OpenAI's own word for the subscription — `plus`, `pro`, `team` — verbatim and never recased,
    /// and `nil` where the token names none. Absent rather than a word nothing said, so the
    /// attribution can go quiet instead of inventing a tier (`CONTEXT.md` L2 · degrade-down).
    public let plan: String?

    public init(email: String, plan: String?) {
        self.email = email
        self.plan = plan
    }
}

/// Reading that sign-in off disk. Its own type, because the failure to find one is a refusal the
/// cockpit repeats back rather than a nil somebody forgot to check.
enum CodexSignInReader {
    /// Where the CLI keeps it. `CODEX_HOME` overrides, which is what lets a test point at a
    /// directory holding a sign-in it wrote.
    static func home(_ environment: [String: String] = ProcessInfo.processInfo.environment) -> URL {
        if let named = environment["CODEX_HOME"], !named.isEmpty {
            return URL(fileURLWithPath: named)
        }
        return FileManager.default.homeDirectoryForCurrentUser.appending(path: ".codex")
    }

    /// The sign-in, or the refusal saying which way it was absent.
    static func read(in home: URL) throws(BacklogAskRefusal) -> CodexSignIn {
        guard let data = try? Data(contentsOf: home.appending(path: "auth.json")) else {
            throw .noSignIn(detail: "Codex is not signed in on this Mac")
        }
        let file = try? JSONDecoder().decode(CodexAuthFile.self, from: data)
        guard let token = file?.tokens?.idToken else {
            throw .noSignIn(detail: "Codex holds an API key rather than a ChatGPT sign-in")
        }
        return try claims(token)
    }

    /// The two claims Argo reads out of the id token's payload.
    ///
    /// The plan is NESTED under one namespaced key rather than being a namespaced key of its own —
    /// `https://api.openai.com/auth` is an object, and reading it as a flat
    /// `…/auth/chatgpt_plan_type` finds nothing. Verified against the token `codex-cli` 0.147.0
    /// wrote on 2026-09-05.
    private static func claims(_ token: String) throws(BacklogAskRefusal) -> CodexSignIn {
        guard let payload = JWTPayload.decode(token),
              let email = payload["email"] as? String
        else {
            throw .noSignIn(detail: "Codex's sign-in names nobody")
        }
        let openAI = payload["https://api.openai.com/auth"] as? [String: Any]
        return CodexSignIn(email: email, plan: openAI?["chatgpt_plan_type"] as? String)
    }
}

/// The slice of `auth.json` Argo parses, at the boundary and once.
private struct CodexAuthFile: Decodable {
    struct Tokens: Decodable {
        let idToken: String?

        enum CodingKeys: String, CodingKey {
            case idToken = "id_token"
        }
    }

    let tokens: Tokens?
}
