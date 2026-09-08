import ArgoEngine
@testable import ArgoUI
import Testing

@Suite("Harness run facts")
struct HarnessRunFactsTests {
    @Test func `a Codex shows its own models and the selected models effort choices`() {
        var facts = RunFacts(
            model: "codex-first",
            effort: .exactly(.ultra, cli: "ultra"),
            chooses: .both,
        )
        facts.harness = .codex
        facts.catalog = SessionRunCatalog(models: [
            .init(id: "codex-first", name: "First", efforts: [.high, .ultra], defaultEffort: .high),
        ])
        #expect(facts.words == "Codex · First · Ultra")
        #expect(facts.models.map(\.id) == ["codex-first"])
        #expect(facts.efforts == [.high, .ultra])
    }

    @Test func `an existing Session offers no harness setter`() {
        let control = RunFactsControl()
        #expect(control.setHarness == nil)
        #expect(RunSettingsPopover.harnessLockedWords
            == "you can't change harness during a session create a new session")
    }
}
