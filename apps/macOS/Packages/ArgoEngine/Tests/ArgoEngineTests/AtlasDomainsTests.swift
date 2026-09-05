@testable import ArgoEngine
import AtlasLayout
import Testing

/// What the inference makes of a repository, over file lists written here rather than measured:
/// every claim is about one rule of the guess — who belongs, who belongs to nothing, what a
/// Domain is called, and what the two numbers beside them mean.
///
/// A real repository is `AtlasGenerationTests`.
@Suite("Atlas — domains inferred from names and co-change")
struct AtlasDomainsTests {
    /// Two subjects, spelled the way a repository spells them: files scattered over folders that
    /// have nothing to do with each other, sharing only what they are called.
    ///
    /// The unrelated files are most of the list on purpose. A word on a fifth of a repository is
    /// barred from naming anything, and in a repository of eight files EVERY word a domain shares
    /// is on a quarter of it — so a fixture that small proves the opposite of what it looks like.
    private let paths = [
        "argo/Sources/TicketProvider.swift",
        "argo/Sources/TicketRow.swift",
        "argo/Sources/Backlog/TicketBacklog.swift",
        "argo/Tests/TicketProviderTests.swift",
        "argo/Sources/PermissionGate.swift",
        "argo/Sources/Deck/PermissionPrompt.swift",
        "argo/Tests/PermissionGateTests.swift",
        "argo/Sources/PermissionExpiry.swift",
    ] + [
        "Anvil", "Bramble", "Cinder", "Dovetail", "Ember", "Fathom", "Gantry", "Harrow",
        "Inlet", "Junction", "Kestrel", "Lantern", "Mortise", "Notch", "Orchard", "Purlin",
        "Quarry",
    ].map { "argo/Sources/\($0).swift" }

    private func inferred(_ couplings: [AtlasCoupling] = []) -> AtlasInference {
        AtlasDomains.inferred(over: paths, coupledBy: couplings, called: "argo")
    }

    @Test func `files about one subject land in one Domain, wherever they sit`() {
        let inference = inferred()
        let ticket = inference.domain(of: "argo/Sources/TicketProvider.swift")

        #expect(ticket?.paths.contains("argo/Sources/Backlog/TicketBacklog.swift") == true)
        #expect(ticket?.paths.contains("argo/Sources/PermissionGate.swift") == false)
        #expect(inference.domains.count == 2)
    }

    @Test func `a Domain is named for the word concentrated in it`() {
        // Not the heaviest word: the repository's own name is on a sixth of the filenames here
        // and would win any sum while naming nothing.
        #expect(Set(inferred().domains.map(\.name)) == ["ticket", "permission"])
    }

    @Test func `the repository's own name never names a Domain`() {
        // Every Domain in Argo is an Argo domain. It is a fact rather than a heuristic, so it is
        // passed in rather than guessed at, and it is barred from the LABEL only — the word stays
        // in the vectors, where it is harmless.
        let named = paths.map { $0.replacingOccurrences(of: "/Sources/", with: "/Argo") }
        let inference = AtlasDomains.inferred(over: named, coupledBy: [], called: "argo")

        #expect(!inference.domains.contains { $0.name == "argo" })
    }

    @Test func `two Domains never answer to one name`() {
        let names = inferred().domains.map(\.name)

        #expect(Set(names).count == names.count)
    }

    @Test func `a file more one Domain than another by too little belongs to nothing`() {
        // The claim the whole margin exists for: a partition has no way to say "I do not know",
        // and a map that colours a lockfile as though it had a subject lies quietly.
        let stray = paths + ["argo/Sources/Bundle.lock", "argo/vendor/minified.js"]
        let inference = AtlasDomains.inferred(over: stray, coupledBy: [], called: "argo")

        #expect(inference.domain(of: "argo/Sources/Bundle.lock") == nil)
        #expect(inference.domain(of: "argo/vendor/minified.js") == nil)
    }

    @Test func `what changes together makes a Domain the names never would`() throws {
        // The whole reason history is read at all: three files about one subject under three
        // unrelated names are invisible to the lexical half, and what changes together is the
        // only signal every repository has that sees them.
        let together = ["Anvil", "Bramble", "Cinder"].map { "argo/Sources/\($0).swift" }
        let joined = inferred([
            AtlasCoupling(first: together[0], second: together[1], strength: 1),
            AtlasCoupling(first: together[1], second: together[2], strength: 1),
            AtlasCoupling(first: together[0], second: together[2], strength: 1),
        ])

        #expect(inferred().domain(of: together[0]) == nil)
        let found = try #require(joined.domain(of: together[0]))
        #expect(Set(found.paths) == Set(together))
    }

    @Test func `the agreement between the two readings is reported`() throws {
        // With no answer key, the rate at which two independent readings agree is the only
        // accuracy number there is. It is stated, never acted on.
        let agreement = try #require(inferred().agreement)

        #expect(agreement >= 0)
        #expect(agreement <= 1)
    }

    @Test func `a repository too small to hold a Domain infers none, and says so`() {
        let inference = AtlasDomains.inferred(
            over: ["argo/README.md", "argo/LICENSE"], coupledBy: [], called: "argo",
        )

        #expect(inference.domains.isEmpty)
        #expect(inference.agreement == nil)
    }

    @Test func `one repository inferred twice is inferred the same way`() {
        // Two runs over one unchanged repository must draw one map, and every ordering this
        // depends on is settled by hand for that reason.
        #expect(inferred().domains == inferred().domains)
    }
}
