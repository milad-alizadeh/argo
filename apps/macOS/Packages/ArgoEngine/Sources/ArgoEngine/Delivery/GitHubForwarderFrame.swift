import Foundation

/// The hook GitHub's webhook forwarder answers a create with.
///
/// `ws_url` is absent on a hook created the ordinary way, and the forwarder belongs to a CLI
/// preview GitHub can change or withdraw without notice — so its absence is simply no socket rather
/// than a failure worth a word (#1579).
struct GitHubForwarderHook: Decodable {
    /// What a delete is keyed by. GitHub has no delete keyed by a hook's name, and the 422 that
    /// says a hook is already there names no id, so the repository's own listing is the only place
    /// the id of the hook it holds can be read (#1697).
    let id: Int
    /// `cli` on the forwarder's hook and `web` on an ordinary webhook, which is what tells the one
    /// Argo made from ones somebody else set up. Optional because the create answers a hook the
    /// caller already knows the name of, and only the listing was measured carrying it.
    let name: String?
    let wsUrl: String?
}

/// One delivery as the forwarder writes it, measured against the live socket on 2026-09-07 (#1579).
///
/// It is not in the public webhooks documentation and does not match the ordinary webhook payload:
/// the fields are lower-case, and `header` maps each name to every value it was sent with. Only the
/// event name is read — the body says what moved, and what moved is the derivation's to read from
/// the API rather than this socket's to hand on.
struct GitHubForwarderFrame: Decodable {
    let header: [String: [String]]

    /// GitHub's own name for what happened, in the spelling the forwarder sends it in.
    var event: String? {
        header["X-Github-Event"]?.first
    }
}
