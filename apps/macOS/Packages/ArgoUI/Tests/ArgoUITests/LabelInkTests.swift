import ArgoEngine
@testable import ArgoUI
import Testing

/// How a provider's own label colour is read into the inks a chip draws with.
@Suite("Label ink")
struct LabelInkTests {
    @Test
    func `a label the provider gave no colour has no ink to draw with`() {
        #expect(LabelInk(WorkItemLabel(name: "work-room")) == nil)
    }

    /// Absence and unreadable collapse to the same answer deliberately: a colour Argo could not
    /// parse is one nobody stated, and a chip that guessed would be asserting a fact.
    @Test(arguments: ["", "fff", "#12345", "ggggggg", "d73a4a7", "not-a-colour"])
    func `a colour Argo cannot read is a colour nobody stated`(hex: String) {
        #expect(LabelInk(WorkItemLabel(name: "bug", colour: hex)) == nil)
    }

    @Test(arguments: ["d73a4a", "#d73a4a", "D73A4A"])
    func `six hex digits are read with or without the hash, in either case`(hex: String) {
        #expect(ArgoColor(providerHex: hex) == ArgoColor(hex: 0xD73A4A))
    }

    /// The whole point of the treatment: the hue survives, its weight does not. A ground as strong
    /// as GitHub's own red would be brighter than any surface in the room.
    @Test
    func `the ground is a wash of the provider's hue, never the hue itself`() throws {
        let ink = try #require(LabelInk(WorkItemLabel(name: "bug", colour: "d73a4a")))

        #expect(ink.ground.opacity < 0.25)
        #expect(ink.edge.opacity < ink.word.opacity)
        #expect(ink.word.opacity == 1)
    }

    /// A label set in a near-black against a white page must not become a word nobody can read on
    /// a dark deck.
    @Test(arguments: ["000000", "0d1117", "1d76db"])
    func `a colour too dark for this deck is lifted until the word reads`(hex: String) throws {
        let ink = try #require(LabelInk(WorkItemLabel(name: "label", colour: hex)))
        let luminance = 0.2126 * ink.word.red + 0.7152 * ink.word.green + 0.0722 * ink.word.blue

        #expect(luminance >= 0.71)
    }

    /// Lifted by SCALING and not by blending toward white — two labels a reader chose as different
    /// colours have to stay different.
    @Test
    func `two dark labels stay different colours after the lift`() throws {
        let red = try #require(LabelInk(WorkItemLabel(name: "a", colour: "800000")))
        let blue = try #require(LabelInk(WorkItemLabel(name: "b", colour: "000080")))

        #expect(red.word != blue.word)
    }

    /// A colour already light enough is left exactly as the provider set it.
    @Test
    func `a colour bright enough is passed through untouched`() {
        #expect(ArgoColor(hex: 0xA2EEEF).lifted(to: 0.72) == ArgoColor(hex: 0xA2EEEF))
    }
}
