@testable import ArgoEngine
import Foundation
import Testing

/// What the reader makes of git's answers, asked of the parse directly rather than through a
/// repository on disk — including the answers it cannot read.
@Suite("Checkout reading")
struct CheckoutReaderTests {
    private static let candidateURL = URL(fileURLWithPath: "/tmp/argo/apps/macOS")
    private static let repositoryURL = URL(fileURLWithPath: "/tmp/argo")

    @Test
    func `a folder inside a repository resolves to the repository root`() async {
        let reader = CheckoutReader(git: gitAnswering([
            toplevel: "/tmp/argo\n",
            head: "main\n",
        ]))

        let projection = await reader.read(at: Self.candidateURL)

        #expect(projection.repositoryURL == Self.repositoryURL)
    }

    @Test
    func `the checked-out branch is the head`() async {
        let reader = CheckoutReader(git: gitAnswering([
            toplevel: "/tmp/argo\n",
            head: "argo/#443-checkout-seam\n",
        ]))

        let projection = await reader.read(at: Self.candidateURL)

        #expect(projection.head == .branch("argo/#443-checkout-seam"))
    }

    @Test
    func `a detached head is the short SHA it is on`() async {
        let reader = CheckoutReader(git: gitAnswering([
            toplevel: "/tmp/argo\n",
            head: "HEAD\n",
            shortSHA: "95a8d79\n",
        ]))

        let projection = await reader.read(at: Self.candidateURL)

        #expect(projection.head == .detached(shortSHA: "95a8d79"))
    }

    /// No root to resolve — git said nothing, or said nothing readable. The folder keeps its own
    /// path: answering with somebody else's root would be a Project the user is not in.
    @Test(arguments: [[:], [toplevel: "  \n"]])
    func `a folder in no repository is unavailable at its own path`(
        answers: [String: String],
    ) async {
        let reader = CheckoutReader(git: gitAnswering(answers))

        let projection = await reader.read(at: Self.candidateURL)

        #expect(projection == CheckoutProjection(
            repositoryURL: Self.candidateURL,
            head: .unavailable,
        ))
    }

    /// Every answer git gives about a head that Argo cannot read. The root is known in each of
    /// these — only the head is not — so the repository stands and the head degrades rather than
    /// the whole read.
    @Test(arguments: [
        [toplevel: "/tmp/argo\n"],
        [toplevel: "/tmp/argo\n", head: "  \n"],
        [toplevel: "/tmp/argo\n", head: "HEAD\n"],
        [toplevel: "/tmp/argo\n", head: "HEAD\n", shortSHA: "  \n"],
    ])
    func `a head git did not answer for is unavailable`(answers: [String: String]) async {
        let reader = CheckoutReader(git: gitAnswering(answers))

        let projection = await reader.read(at: Self.candidateURL)

        #expect(projection == CheckoutProjection(
            repositoryURL: Self.repositoryURL,
            head: .unavailable,
        ))
    }

    /// git ends every answer with a newline, and a branch named with one would not be a branch.
    @Test
    func `the newline git ends its answer with is not part of the branch`() async {
        let reader = CheckoutReader(git: gitAnswering([
            toplevel: "  /tmp/argo  \n",
            head: "main\n",
        ]))

        let projection = await reader.read(at: Self.candidateURL)

        #expect(projection == CheckoutProjection(
            repositoryURL: Self.repositoryURL,
            head: .branch("main"),
        ))
    }
}

/// The three questions a checkout read asks git, as the tables above key them.
private let toplevel = "rev-parse --show-toplevel"
private let head = "rev-parse --abbrev-ref HEAD"
private let shortSHA = "rev-parse --short HEAD"

/// The other adapter of the same port the app runs `git` through: a table of what git would say,
/// keyed by the arguments asked. Anything absent is a command that answered nothing.
private func gitAnswering(_ answers: [String: String]) -> GitCommand {
    { arguments, _ in answers[arguments.joined(separator: " ")] }
}
