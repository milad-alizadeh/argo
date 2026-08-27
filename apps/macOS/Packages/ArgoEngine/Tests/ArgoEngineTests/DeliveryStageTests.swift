@testable import ArgoEngine
import Foundation
import Testing

/// How far the product in flight has got, read off what was observed (`CONTEXT.md` L4).
@Suite("Delivery lifecycle")
struct DeliveryStageTests {
    @Test
    func `a branch with no pull request is at its commits`() {
        #expect(Delivery(branch: "spike/idea", pullRequest: nil).stage == .commits)
    }

    @Test
    func `an open pull request with nothing observed on it is at pr`() {
        #expect(Delivery(branch: "b", pullRequest: .stub(number: 1)).stage == .pr)
    }

    @Test
    func `a pull request with checks is at ci`() {
        let delivery = Delivery(
            branch: "b",
            pullRequest: .stub(number: 1),
            observed: .init(checks: [DeliveryCheck(name: "macos", status: "success")]),
        )

        #expect(delivery.stage == .ci)
    }

    @Test
    func `a pull request with a submitted review is at review`() {
        let delivery = Delivery(
            branch: "b",
            pullRequest: .stub(number: 1),
            observed: .init(
                checks: [DeliveryCheck(name: "macos", status: "success")],
                reviews: [DeliveryReview(author: "octocat", verdict: "APPROVED", reviewedSHA: nil)],
            ),
        )

        #expect(delivery.stage == .review)
    }

    @Test
    func `merge is the terminal node, reached however much else was observed`() {
        let merged = DeliveryPullRequest(
            number: 1,
            title: "A change",
            state: "closed",
            facts: .init(isDraft: false, isMerged: true, baseBranch: "main", headSHA: "c0ffee"),
            body: nil,
            url: nil,
        )
        let delivery = Delivery(
            branch: "b",
            pullRequest: merged,
            observed: .init(reviews: [
                DeliveryReview(author: "octocat", verdict: "APPROVED", reviewedSHA: nil),
            ]),
        )

        #expect(delivery.stage == .merge)
    }

    @Test
    func `the reserved nodes are deploy and release`() {
        #expect(DeliveryStage.allCases.filter(\.isReserved) == [.deploy, .release])
    }

    @Test
    func `the wired nodes are the five the strip draws`() {
        #expect(DeliveryStage.wired == [.commits, .pr, .ci, .review, .merge])
    }

    @Test(arguments: DeliveryStage.allCases.filter(\.isReserved))
    func `a reserved node stays unwired`(_ reserved: DeliveryStage) {
        // Nothing observes a deployment, so no Delivery may ever claim to be at one.
        let observed = Delivery.Observed(
            checks: [DeliveryCheck(name: "macos", status: "success")],
            reviews: [DeliveryReview(author: "octocat", verdict: "APPROVED", reviewedSHA: nil)],
        )

        #expect(Delivery(
            branch: "b", pullRequest: .stub(number: 1), observed: observed,
        ).stage != reserved)
    }
}
