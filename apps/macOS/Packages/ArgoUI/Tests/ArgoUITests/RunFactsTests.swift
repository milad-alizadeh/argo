import ArgoEngine
@testable import ArgoUI
import Testing

/// What the composer states about what a Session runs at, and what the popover does with it (#558).
///
/// Every claim here is a rule the two views defer to, which is why they are made on the derived
/// value rather than through a rendered control: the trigger's ink, the sections drawn, the row
/// ticked and the reset's sentence are all answers this settles.
@Suite("Run facts")
struct RunFactsTests {
    private func facts(
        model: String? = "claude-opus-5",
        effort: SessionEffortReading = .exactly(.medium, cli: "medium"),
        chooses: RunFactKnobs = .both,
    )
        -> RunFacts {
        RunFacts(model: model, effort: effort, chooses: chooses)
    }

    @Test
    func `the trigger says both facts, dot-separated`() {
        #expect(facts().words == "Opus 5 · Medium")
    }

    /// Acceptance criterion 2, on both halves: never normalised, never dropped.
    @Test
    func `a model and a level Argo does not recognise are stated as given`() {
        let unread = facts(model: "claude-mythos-7", effort: .unknown(cli: "ludicrous"))

        #expect(unread.words == "claude-mythos-7 · ludicrous")
    }

    /// A pinned snapshot is not a different model — the rule `ReadableModelName` owns, asserted
    /// here because this is the surface that now states it.
    @Test
    func `a pinned snapshot reads as the model it is a snapshot of`() {
        #expect(facts(model: "claude-opus-4-1-20250805").modelWords == "Opus 4.1")
        // Eight digits after a hyphen and nothing else: a name that merely ENDS in a number keeps
        // it.
        #expect(facts(model: "mystery-1234").modelWords == "mystery-1234")
    }

    /// Criterion 3: the word itself, never a plausible value.
    @Test
    func `a fact the adapter could not establish reads unknown`() {
        #expect(facts(model: nil).words == "unknown · Medium")
        #expect(facts(effort: .unknown(cli: nil)).words == "Opus 5 · unknown")
    }

    /// The trigger is quiet at the defaults and brightens off them, so what it costs a reader to
    /// notice is the one thing worth noticing.
    @Test
    func `only both facts at their defaults reads as default`() {
        #expect(facts().isDefault)
        #expect(!facts(model: "claude-sonnet-5").isDefault)
        #expect(!facts(effort: .exactly(.xhigh, cli: "xhigh")).isDefault)
    }

    /// An unestablished fact is NOT quiet: it is exactly the one worth looking at, and drawing it
    /// at the default's ink would hide it.
    @Test
    func `an unknown fact is never the default`() {
        #expect(!facts(model: nil).isDefault)
        #expect(!facts(effort: .unknown(cli: nil)).isDefault)
    }

    /// Criterion 4: declared, not discovered. Neither knob means nothing to open at all, which is
    /// what leaves the facts as words on the footer.
    @Test
    func `the trigger opens only where a knob is declared`() {
        #expect(facts().canOpen)
        #expect(facts(chooses: RunFactKnobs(effort: true)).canOpen)
        #expect(facts(chooses: RunFactKnobs(model: true)).canOpen)
        #expect(!facts(chooses: RunFactKnobs()).canOpen)
    }

    /// The three the design offers, and no more — until the Session is on something else.
    @Test
    func `the model list is the offered three where the reading is one of them`() {
        #expect(facts().models.map(\.name) == ["Opus 5", "Sonnet 5", "Haiku 4.5"])
        #expect(facts().tickedModel?.id == "opus")
    }

    /// The other half of criterion 2: a reading off the list earns a row of its own, so the tick
    /// has somewhere honest to land. A list with nothing ticked would read as a Session on no
    /// model at all.
    @Test
    func `a reading off the offered list gets a row of its own, ticked`() {
        let unread = facts(model: "claude-mythos-7")

        #expect(unread.models.map(\.name).last == "claude-mythos-7")
        #expect(unread.tickedModel?.id == "claude-mythos-7")
    }

    /// A tick is the control saying *this is where you are*, so a Session whose records have named
    /// no model ticks nothing — the rule an inexact Mode reading follows (#545).
    @Test
    func `a Session on no model at all ticks nothing`() {
        #expect(facts(model: nil).tickedModel == nil)
        // And no row is invented for the absence: the list stays the offered three.
        #expect(facts(model: nil).models.count == 3)
    }

    /// The reset NAMES what it restores rather than saying "default" — a reader should not have to
    /// open it to find out. All three, Mode included, because it sets all three.
    ///
    /// It names where the values LAND and never where the Session currently is: a Session on Auto
    /// reading `Reset to Auto` would be the control lying about what pressing it does.
    @Test
    func `the reset names the three values it restores to, whatever the Session is on`() {
        #expect(RunFacts.resetWords == "Reset to Code · Opus 5 · Medium")
        #expect(RunFacts.defaultMode == .code)
    }
}
