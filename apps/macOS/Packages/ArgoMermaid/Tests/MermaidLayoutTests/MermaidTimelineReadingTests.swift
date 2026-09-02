@testable import MermaidLayout
import Testing

/// What a `timeline` fence is read as, and what it is NOT read as. A line this reader has no rule
/// for leaves the whole block the fence it is today.
@Suite("Mermaid timeline reading")
struct MermaidTimelineReadingTests {
    private static func read(_ body: String) -> MermaidTimeline? {
        MermaidTimeline.read("timeline\n" + body)
    }

    @Test
    func `a period carries the event written after it`() {
        #expect(Self.read("2002 : LinkedIn")?.sections
            == [.init(periods: [.init(name: "2002", events: ["LinkedIn"])])])
    }

    /// The whole point of the row: one period, several events, and every one of them drawn.
    @Test
    func `a period carries every event written after it`() {
        #expect(Self.read("2004 : Facebook : Google : Flickr")?.sections.first?.periods.first?
            .events == ["Facebook", "Google", "Flickr"])
    }

    /// Mermaid draws a period that nothing happened in, and so does this.
    @Test
    func `a period with no events is still a period`() {
        #expect(Self.read("2003")?.sections.first?.periods == [.init(name: "2003", events: [])])
    }

    @Test
    func `a section takes the periods written under it`() {
        let timeline = Self.read("section 2000s\n2002 : LinkedIn\nsection 2010s\n2010 : Instagram")

        #expect(timeline?.sections.map(\.name) == ["2000s", "2010s"])
        #expect(timeline?.sections.map { $0.periods.map(\.name) } == [["2002"], ["2010"]])
    }

    /// The acceptance criterion in its own words: a timeline that never says `section` is read,
    /// and its periods keep one unnamed band.
    @Test
    func `a timeline with no sections keeps one unnamed band`() {
        let timeline = Self.read("2002 : LinkedIn\n2004 : Facebook")

        #expect(timeline?.sections.count == 1)
        #expect(timeline?.sections.first?.name.isEmpty == true)
        #expect(timeline?.sections.first?.periods.map(\.name) == ["2002", "2004"])
    }

    @Test
    func `the title is read from its own line`() {
        #expect(Self.read("title A history of the feed\n2002 : LinkedIn")?.title
            == "A history of the feed")
    }

    @Test(arguments: [
        "graph TD\nA --> B",
        "pie\n\"Read\" : 3",
        "timelines\n2002 : LinkedIn",
        "timeline",
        "timeline\nsection 2000s",
        "",
    ])
    func `a source this reader does not own is refused`(source: String) {
        #expect(MermaidTimeline.read(source) == nil)
    }

    /// A row whose period is nothing but a colon names no band of the axis, so the block stays a
    /// fence rather than drawing a column with no heading.
    @Test(arguments: [": LinkedIn", " : ", "   :"])
    func `a row with no period refuses the whole timeline`(body: String) {
        #expect(Self.read(body) == nil)
    }

    /// A keyword carrying no words is decidable, so it is refused rather than drawn as a period
    /// called `section` standing beside the real ones — the phantom this reader must not make.
    @Test(arguments: [
        "section\n2002 : LinkedIn",
        "2002 : LinkedIn\nsection",
        "title\n2002 : LinkedIn",
        "2002 : LinkedIn\ntitle",
    ])
    func `a keyword with no words refuses the whole timeline`(body: String) {
        #expect(Self.read(body) == nil)
    }

    /// Every field has to say something. A row with an empty one is content the source wrote and
    /// this reader cannot place, so the block stays a fence rather than closing the gap up.
    @Test(arguments: ["2004 : Facebook : : Google", "2004 :", "2004 : Facebook :"])
    func `a row with an empty field refuses the whole timeline`(body: String) {
        #expect(Self.read(body) == nil)
    }

    @Test
    func `a timeline fence reaches the diagram as its own kind`() {
        #expect(MermaidDiagram.read("timeline\n2002 : LinkedIn")?.kind
            == .timeline(MermaidTimeline(sections: [
                .init(periods: [.init(name: "2002", events: ["LinkedIn"])]),
            ])))
    }
}
