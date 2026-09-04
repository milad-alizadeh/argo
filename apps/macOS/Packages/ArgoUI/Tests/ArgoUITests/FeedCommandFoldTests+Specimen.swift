@testable import ArgoSpecimens
@testable import ArgoUI
import Testing

/// What the shipped specimen's own rows fold into. Held apart from the rules above: these are
/// claims about a FIXTURE, and they fail when the fixture drifts rather than when a rule does.
extension FeedCommandFoldTests {
    /// Asserted here so a fixture change that quietly stopped it folding fails the suite rather
    /// than producing a screenshot that no longer shows what its caption says.
    @Test
    func `the specimen folds seven quiet calls into one counted line`() throws {
        let survey = try #require(FeedFixture.surveys(in: FeedProjection.previewFoldRows).first)

        #expect(survey.label == "Read 2 Files · Ran 5 Commands")
    }

    /// The three rows are the fold, the change it was for, and the card the two loud commands
    /// after it fold into.
    @Test
    func `the specimen leaves the mutation a row and cards the two loud commands`() {
        #expect(FeedProjection.previewFoldRows.count == 3)
        #expect(FeedFixture.work(in: FeedProjection.previewFoldRows)
            .map(\.label) == ["Ran 2 Commands"])
    }
}
