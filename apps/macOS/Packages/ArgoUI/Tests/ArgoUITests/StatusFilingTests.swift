import ArgoEngine
@testable import ArgoUI
import Testing

/// Whether Argo's filing is worth setting beside the provider's own word (#893).
@Suite("Status filing beside the provider's word")
struct StatusFilingTests {
    @Test(arguments: [
        (TicketState.open, "open"),
        (.open, "Open"),
        (.ruledOut, "Ruled out"),
    ])
    func `a filing the word already says is left to the word`(
        bucket: TicketState, word: String,
    ) {
        #expect(bucket.filing(beside: word) == nil)
    }

    @Test(arguments: [
        // GitHub's state stays `open` while a Session holds the ticket, so the claim is the one
        // thing a word can never carry.
        (TicketState.claimed, "open", "claimed"),
        (.resolved, "Done", "resolved"),
        (.ruledOut, "Cancelled", "ruled out"),
    ])
    func `a filing the word cannot carry is set beside it`(
        bucket: TicketState, word: String, filing: String,
    ) {
        #expect(bucket.filing(beside: word) == filing)
    }
}
