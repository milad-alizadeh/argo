import Testing
@testable import ArgoEngine

// A transcript's user records are not all prompts. These are the readings that decide which ones
// ARE — and every one of them is still verbatim: the words come from the fields the CLI put them
// in, never from a rewording of the markup it wrapped them in.

@Suite("Prompt reading")
struct PromptReadingTests {
    private func prompts(_ fixture: String) async throws -> [String] {
        try await Fixture.events(fixture).compactMap { event -> String? in
            guard case let .prompt(text, _) = event else { return nil }
            return text
        }
    }

    @Test("The harness talking to itself opens no prompt")
    func harnessMetaIsNotAPrompt() async throws {
        let read = try await prompts("harnessNoise")

        // The caveat, the skill's expanded body and the pasted-image preamble are all `isMeta`.
        // Taken at face value they would open three turns, each titled with the CLI's plumbing.
        #expect(!read.contains { $0.hasPrefix("<local-command-caveat>") })
        #expect(!read.contains { $0.hasPrefix("Base directory for this skill") })
        #expect(!read.contains { $0.hasPrefix("[Image: original") })
    }

    @Test("A slash command reads as the command the user typed")
    func slashCommandsAreReassembled() async throws {
        let read = try await prompts("harnessNoise")

        // Three sibling tags in one record. The raw text would title the exchange
        // `<command-message>implement</command-message>`, which is markup nobody saw.
        #expect(read.contains("/implement 318 open storybook while you do it"))
        #expect(read.contains("/effort"))
    }

    @Test("A local command's stdout is the command's answer, filed as a call not as prose")
    func localCommandOutputBecomesACall() async throws {
        let events = try await Fixture.events("harnessNoise")
        let outcome = try #require(events.outcomes()["u-stdout"])

        guard case let .output(output) = try #require(outcome.result) else {
            Issue.record("a local command's stdout is what it printed")
            return
        }
        // DERIVED: the text is read off an external record rather than owned by Argo.
        #expect(output.tier == .derived)
        #expect(output.text == "Set effort level to medium")
        // And never in the agent's mouth.
        #expect(!events.contains(.message(markdown: "Set effort level to medium")))
    }

    @Test("A prompt keeps its own whitespace")
    func promptsAreUnclamped() async throws {
        let read = try await prompts("prose")

        // Trimming here would be a reworded prompt: the indentation is the user's.
        #expect(read.contains("    read this file\n\n      and keep my indentation"))
    }

    @Test("A whitespace-only record asks for nothing")
    func blankPromptsAreAbsent() async throws {
        let read = try await prompts("prose")
        #expect(!read.contains { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty })
    }

    @Test("Steering text mid-run is a prompt like any other")
    func steeringIsAPrompt() async throws {
        #expect(try await prompts("prose").contains("steered mid-run"))
    }

    @Test("A compact summary is a marker, never a prompt titled with the whole history")
    func compactionIsNotAPrompt() async throws {
        let events = try await Fixture.events("treeFull")

        #expect(events.contains { if case .compaction = $0 { true } else { false } })
        #expect(!events.contains(.prompt(text: "<summary of earlier history>", atMs: nil)))
        let read = try await prompts("treeFull")
        #expect(!read.contains("<summary of earlier history>"))
    }

    @Test("The plan the agent wrote is read off the tool that wrote it")
    func planIsReadFromItsTool() async throws {
        let events = try await Fixture.events("treeFull")
        let plans = events.compactMap { event -> Plan? in
            guard case let .plan(plan) = event else { return nil }
            return plan
        }
        let plan = try #require(plans.first)

        // Four todos in the fixture, one of which has no `content`. An entry with no text is
        // dropped rather than shown blank.
        #expect(plan.entries.count == 3)
        #expect(plan.entries.map(\.status) == [.completed, .inProgress, .pending])
        #expect(plan.entries.first?.text == "Read the observer")
    }

    @Test("Prose keeps thoughts and messages apart, in the order they were emitted")
    func thoughtsAreNotMessages() async throws {
        let prose = try await Fixture.events("prose").compactMap { event -> String? in
            switch event {
            case let .message(markdown): "said: \(markdown)"
            case let .thought(markdown): "thought: \(markdown)"
            default: nil
            }
        }

        // A turn's final message routinely contradicts its own reasoning, and the order is the only
        // thing that says which reasoning produced which answer.
        #expect(prose.prefix(5).elementsEqual([
            "thought: no prompt came before me",
            "said: resumed mid-turn",
            "thought: first I weigh it",
            "said: It reads the transcript.",
            "thought: then I doubt it",
        ]))
    }
}
