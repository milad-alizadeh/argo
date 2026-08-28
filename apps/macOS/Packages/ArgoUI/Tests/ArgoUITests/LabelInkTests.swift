import ArgoEngine
@testable import ArgoUI
import Testing

/// How a provider's own label colour is read into the inks a chip draws with.
@Suite("Label ink")
struct LabelInkTests {
    /// The deck's own ground, which is what a chip sits on.
    private let deck = ArgoPalette.graphite.surface.base

    @Test
    func `a label the provider gave no colour has no ink to draw with`() {
        #expect(LabelInk(WorkItemLabel(name: "work-room"), on: deck) == nil)
    }

    /// Absence and unreadable collapse to the same answer deliberately: a colour Argo could not
    /// parse is one nobody stated, and a chip that guessed would be asserting a fact.
    @Test(arguments: ["", "fff", "#12345", "ggggggg", "d73a4a7", "not-a-colour"])
    func `a colour Argo cannot read is a colour nobody stated`(hex: String) {
        #expect(LabelInk(WorkItemLabel(name: "bug", colour: hex), on: deck) == nil)
    }

    @Test(arguments: ["d73a4a", "#d73a4a", "D73A4A"])
    func `six hex digits are read with or without the hash, in either case`(hex: String) {
        #expect(ArgoColor(providerHex: hex) == ArgoColor(hex: 0xD73A4A))
    }

    /// The whole point of the treatment: the hue survives, its weight does not. A ground as strong
    /// as GitHub's own red would be brighter than any surface in the room.
    @Test
    func `the ground is a wash of the provider's hue, never the hue itself`() throws {
        let ink = try #require(LabelInk(WorkItemLabel(name: "bug", colour: "d73a4a"), on: deck))

        #expect(ink.ground.opacity < 0.25)
        #expect(ink.edge.opacity < ink.word.opacity)
        #expect(ink.word.opacity == 1)
    }

    /// The claim the measure exists to make. GitHub's real palette, including the near-blacks a
    /// label set against a white page routinely carries.
    @Test(arguments: ["000000", "0d1117", "1d76db", "d73a4a", "5319e7", "0e8a16", "b60205"])
    func `every provider colour reads at AA against the ground under it`(hex: String) throws {
        let ink = try #require(LabelInk(WorkItemLabel(name: "label", colour: hex), on: deck))

        #expect(ink.word.contrastRatio(on: deck) >= ArgoTicketDetail.labelWordContrast)
    }

    /// The finding that put contrast here in place of a lightness floor: a flat floor moved every
    /// hue by the same rule and turned GitHub's blue cyan. A hue only just short of the ratio must
    /// be moved only just far enough.
    @Test
    func `a hue is moved no further than reading it demands`() throws {
        let ink = try #require(LabelInk(WorkItemLabel(name: "ui", colour: "1d76db"), on: deck))

        // Blue is the channel the reader chose; it must still dominate after the lift.
        #expect(ink.word.blue > ink.word.red)
        #expect(ink.word.blue > ink.word.green)
        // And the lift must stop at the ratio rather than run on to white.
        #expect(ink.word.contrastRatio(on: deck) < ArgoTicketDetail.labelWordContrast + 1)
    }

    /// A colour already clear of the ground is the provider's, untouched.
    @Test
    func `a colour that already reads is left exactly as the provider set it`() {
        let bright = ArgoColor(hex: 0xA2EEEF)

        #expect(bright.carried(to: 4.5, on: deck) == bright)
    }

    /// Moved by SCALING before mixing — two labels a reader chose as different colours have to
    /// stay different.
    @Test
    func `two dark labels stay different colours after the lift`() throws {
        let red = try #require(LabelInk(WorkItemLabel(name: "a", colour: "800000"), on: deck))
        let blue = try #require(LabelInk(WorkItemLabel(name: "b", colour: "000080"), on: deck))

        #expect(red.word != blue.word)
        #expect(red.word.distance(to: blue.word) > 0.2)
    }

    /// The direction is the backdrop's, so the treatment survives a light appearance: against a
    /// pale ground a pale label has to be carried DOWN, not up.
    @Test
    func `against a light ground the word is carried toward black`() {
        let page = ArgoColor(hex: 0xFFFFFF)
        let pale = ArgoColor(hex: 0xA2EEEF)

        let read = pale.carried(to: 4.5, on: page)

        #expect(read.relativeLuminance < pale.relativeLuminance)
        #expect(read.contrastRatio(on: page) >= 4.5)
    }
}
