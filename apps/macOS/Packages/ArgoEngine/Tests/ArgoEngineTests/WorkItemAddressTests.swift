@testable import ArgoEngine
import Foundation
import Testing

/// Where a Work Item is read on the provider's own site, derived from the Binding alone (#872).
@Suite("Work Item address")
struct WorkItemAddressTests {
    @Test func `a GitHub Binding addresses its issue on the code host`() {
        let address = WorkItemAddress(provider: .github, scope: "milad-alizadeh/argo")

        #expect(
            address.browseURL(of: 872)
                == URL(string: "https://github.com/milad-alizadeh/argo/issues/872"),
        )
    }

    @Test(arguments: ["", "   "])
    func `a GitHub Binding with no repository behind it addresses nothing`(scope: String) {
        #expect(WorkItemAddress(provider: .github, scope: scope).browseURL(of: 872) == nil)
    }

    /// A Linear Binding's scope is a team id, and a Linear issue is addressed by workspace slug and
    /// team KEY — neither of which the Binding holds.
    @Test func `a Linear Binding cannot address its issue`() {
        let address = WorkItemAddress(
            provider: .linear, scope: "a7f3c1e0-0000-4000-8000-000000000000",
        )

        #expect(address.browseURL(of: 872) == nil)
    }

    /// The port's own answer, so #371's second adapter proves this like every other method there.
    @Test func `each adapter answers for its own provider`() {
        #expect(
            GitHubWorkItems.browseURL(of: 5, in: "owner/repo")
                == URL(string: "https://github.com/owner/repo/issues/5"),
        )
        #expect(LinearWorkItems.browseURL(of: 5, in: "team-id") == nil)
    }

    /// A ticket number no provider issues is not addressable: providers number from one.
    @Test(arguments: [0, -3])
    func `a number no provider issues addresses nothing`(number: Int) {
        #expect(WorkItemAddress(provider: .github, scope: "owner/repo")
            .browseURL(of: number) == nil)
    }
}
