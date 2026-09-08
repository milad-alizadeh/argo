import Foundation

/// The hook GitHub's webhook forwarder answers a create with.
///
/// `ws_url` is absent on a hook created the ordinary way, and the forwarder belongs to a CLI
/// preview GitHub can change or withdraw without notice — so its absence is simply no socket rather
/// than a failure worth a word (#1579).
struct GitHubForwarderHook: Decodable {
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
