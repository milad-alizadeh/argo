import Foundation

/// The validator each URL was last answered with, so the next ask for it can be conditional.
///
/// Keyed by the request's URL and nothing else: GitHub's `ETag` is a property of the response to
/// one URL, and the two polls only ever ask GETs, whose URL carries every parameter that could
/// change the answer — the page number and the branch included. A verb or a body in the key would
/// be pretending this holds more than it does.
///
/// An actor rather than a dictionary on the transport because the transport is a `Sendable` struct
/// copied into every adapter, and two ticks overlapping is the normal case, not the edge one.
actor ETagLedger {
    private var validators: [String: String] = [:]
    /// Which URL each entry arrived on, oldest first, so the bound below can shed the oldest.
    private var arrivals: [String] = []

    /// Room for a checkout with a few hundred worktrees and both polls' listings, and a bound
    /// rather than none because the fan-out is keyed per BRANCH: a checkout that cycles worktrees
    /// asks about names that will never be asked about again, and nothing here would ever drop
    /// them. Losing an entry costs one full request, which is what a cold tick already pays.
    private static let bound = 1000

    /// What to send as `If-None-Match` for this URL, and `nil` where nothing has answered it yet.
    func validator(for url: String) -> String? {
        validators[url]
    }

    /// Keep what answered this URL. A response with no `ETag` DROPS the one held: the host has
    /// stopped offering to validate this URL, and resending a stale validator would invite a `304`
    /// about a body we would then have no way to reproduce.
    func record(_ etag: String?, for url: String) {
        let held = validators[url]
        validators[url] = etag
        guard etag != nil else {
            arrivals.removeAll { $0 == url }
            return
        }
        if held == nil {
            arrivals.append(url)
        }
        while arrivals.count > Self.bound {
            validators[arrivals.removeFirst()] = nil
        }
    }
}
