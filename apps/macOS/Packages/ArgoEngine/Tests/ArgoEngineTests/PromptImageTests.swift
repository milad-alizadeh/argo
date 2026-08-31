@testable import ArgoEngine
import Testing

// A pasted picture arrives as an `image` block beside the prompt's own words, and the CLI leaves an
// `[Image #3]` placeholder in the text where it landed. Both halves are the prompt (#733): dropping
// the block showed the placeholder as if the user had typed it.

@Suite("Prompt images")
struct PromptImageTests {
    private func prompts(_ fixture: String) async throws -> [(String, [MediaEvidence])] {
        try await Fixture.events(fixture).compactMap { event in
            guard case let .prompt(text, images, _) = event else { return nil }
            return (text, images)
        }
    }

    @Test
    func `A pasted picture reaches the prompt, at the tier the record embedded it`() async throws {
        let (text, images) = try #require(try await prompts("promptImages").first)

        #expect(text == "the header sits too low")
        #expect(images.count == 1)
        // DIRECT: these are the bytes the record carried, not a re-read of a path.
        #expect(images.first?.tier == .direct)
        #expect(images.first?.mediaType == "image/png")
        #expect(images.first?.bytes == .held("HEADER-BYTES"))
    }

    @Test
    func `Several pictures arrive in the order the record carried them`() async throws {
        let (text, images) = try await prompts("promptImages")[1]

        #expect(text == "compare against")
        #expect(images.map(\.mediaType) == ["image/png", "image/jpeg"])
        #expect(images.map(\.bytes) == [.held("BEFORE-BYTES"), .held("AFTER-BYTES")])
    }

    @Test
    func `A prompt that is only a picture keeps no words at all`() async throws {
        let (text, images) = try await prompts("promptImages")[2]

        // The whole of what was asked is the picture. An empty string rather than the placeholder:
        // `[Image #4]` beside the thumbnail says the same thing twice.
        #expect(text.isEmpty)
        #expect(images.count == 1)
    }

    @Test
    func `A placeholder with no picture behind it survives`() async throws {
        let (text, images) = try await prompts("promptImages")[3]

        // One block, two placeholders. Stripping the second would erase the only trace that a
        // picture the reader can no longer see was ever part of the question.
        #expect(text == "and the one I lost, [Image #6]")
        #expect(images.count == 1)
    }

    @Test
    func `A prompt carrying no picture is untouched`() async throws {
        let (text, images) = try await prompts("promptImages")[4]

        #expect(text == "no pictures here, and [Image #7] is only something I typed")
        #expect(images.isEmpty)
    }

    @Test
    func `A record of pictures and no words is still a prompt`() async throws {
        let (text, images) = try await prompts("promptImages")[5]

        #expect(text.isEmpty)
        #expect(images.map(\.bytes) == [.held("WORDLESS-BYTES")])
    }

    @Test
    func `removing a placeholder takes the space beside it and nothing else`() {
        // The space the CLI left, never one the user typed: only one of two spaces in front of a
        // token was the markup's, so the other survives.
        #expect(shorn("look at  [Image #1] this", ofImages: 1) == "look at  this")
        #expect(shorn("this one [Image #1]", ofImages: 1) == "this one")
        #expect(shorn("[Image #1]", ofImages: 1).isEmpty)
        #expect(shorn("[Image #1]x", ofImages: 1) == "x")
    }
}
