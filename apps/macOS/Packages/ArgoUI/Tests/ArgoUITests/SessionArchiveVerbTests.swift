@testable import ArgoUI
import Testing

/// The destructive action's promise follows how directly Argo can reach the agent (#1596,
/// #1609).
struct SessionArchiveVerbTests {
    private struct Example: Sendable {
        let owned: Int
        let matching: Int
        let verb: String
    }

    /// A fallible match is an attempt even beside a DIRECT owned end, while a batch with no route
    /// says that archiving proceeds anyway.
    @Test(arguments: [
        Example(owned: 0, matching: 0, verb: "Archive Anyway"),
        Example(owned: 1, matching: 0, verb: "Archive and End"),
        Example(owned: 0, matching: 1, verb: "Archive and Try to End"),
        Example(owned: 1, matching: 1, verb: "Archive and Try to End"),
    ])
    private func `the verb states how certain the end is`(example: Example) {
        #expect(SessionArchiveProjection.confirmVerb(
            owned: example.owned,
            matching: example.matching,
        ) == example.verb)
    }
}
