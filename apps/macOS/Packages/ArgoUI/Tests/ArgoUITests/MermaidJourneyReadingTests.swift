@testable import ArgoUI
import Testing

/// What a `journey` fence is read as, and — the half that matters more — what it is NOT read as.
/// A task this reader cannot rate leaves the whole block the fence it is today.
@Suite("Mermaid journey reading")
struct MermaidJourneyReadingTests {
    private static func read(_ body: String) -> MermaidJourney? {
        MermaidJourney.read("journey\n" + body)
    }

    @Test
    func `a task carries its score and the actor it names`() {
        let journey = Self.read("Make tea: 5: Me")

        #expect(journey?.sections == [.init(tasks: [.init(
            name: "Make tea", score: 5, actors: ["Me"],
        )])])
    }

    /// Mermaid lets a task name nobody, and the row is still a rated step of the journey.
    @Test
    func `a task with no actors is still a task`() {
        #expect(Self.read("Wait on CI: 2")?.sections.first?.tasks
            == [.init(name: "Wait on CI", score: 2, actors: [])])
    }

    @Test
    func `every actor a task names is kept, in the order it named them`() {
        #expect(Self.read("Review: 3: Me, Argo, CI")?.sections.first?.tasks.first?.actors
            == ["Me", "Argo", "CI"])
    }

    /// The section is the band the tasks under it are drawn in, so a task belongs to the last one
    /// opened and to nothing else.
    @Test
    func `a section takes the tasks written under it`() {
        let journey = Self
            .read("section Morning\nMake tea: 5: Me\nsection Evening\nSit down: 4: Me")

        #expect(journey?.sections.map(\.name) == ["Morning", "Evening"])
        #expect(journey?.sections.map { $0.tasks.map(\.name) } == [["Make tea"], ["Sit down"]])
    }

    /// A journey may open with tasks before it names a band, and those tasks are still drawn.
    @Test
    func `tasks written before the first section keep their own unnamed band`() {
        let journey = Self.read("Wake up: 3: Me\nsection Morning\nMake tea: 5: Me")

        #expect(journey?.sections.map(\.name) == ["", "Morning"])
        #expect(journey?.sections.first?.tasks.map(\.name) == ["Wake up"])
    }

    @Test
    func `the title is read from its own line`() {
        #expect(Self.read("title A working day\nMake tea: 5: Me")?.title == "A working day")
    }

    /// Every reader here owns its own keyword, so the order `MermaidDiagram` asks them in settles
    /// nothing.
    @Test(arguments: [
        "graph TD\nA --> B",
        "pie\n\"Read\" : 3",
        "journeymap\nMake tea: 5: Me",
        "journey",
        "journey\nsection Morning",
        "",
    ])
    func `a source this reader does not own is refused`(source: String) {
        #expect(MermaidJourney.read(source) == nil)
    }

    /// Mermaid's scale is one to five and nothing else, so a score off it is a row this reader has
    /// no rule for — half a journey drawn confidently is worse than the source.
    @Test(arguments: [
        "Make tea: 9: Me",
        "Make tea: 0: Me",
        "Make tea: -1: Me",
        "Make tea: five: Me",
        "Make tea: 3.5: Me",
        "Make tea",
        "Make tea: : Me",
    ])
    func `a row this reader has no rule for refuses the whole journey`(body: String) {
        #expect(Self.read(body) == nil)
    }

    /// A keyword carrying no words is decidable, so it is refused rather than read as a task or a
    /// band nobody named.
    @Test(arguments: [
        "section\nMake tea: 5: Me",
        "Make tea: 5: Me\nsection",
        "title\nMake tea: 5: Me",
        "Make tea: 5: Me\ntitle",
    ])
    func `a keyword with no words refuses the whole journey`(body: String) {
        #expect(Self.read(body) == nil)
    }

    /// Only a row of exactly two fields names nobody. Any longer one takes its score from the
    /// second field back, so an actor that happens to be a number cannot become the score.
    @Test
    func `an actor written as a number is an actor and not the score`() {
        #expect(Self.read("Make tea: 3: 4")?.sections.first?.tasks
            == [.init(name: "Make tea", score: 3, actors: ["4"])])
    }

    /// `MermaidDiagram` is where a fence becomes a block kind, so the journey has to arrive
    /// through it.
    @Test
    func `a journey fence reaches the diagram as its own kind`() {
        let diagram = MermaidDiagram.read("journey\nMake tea: 5: Me")

        #expect(diagram?.kind == .journey(MermaidJourney(sections: [
            .init(tasks: [.init(name: "Make tea", score: 5, actors: ["Me"])]),
        ])))
    }

    /// Every actor the journey names, once each and in the order it first named them — the run the
    /// chips take their hue from, so a name that appears twice is one colour and not two.
    @Test
    func `an actor named on two tasks is one actor`() {
        let journey = Self.read("Make tea: 5: Me, Argo\nReview: 3: Argo, CI")

        #expect(journey?.actors == ["Me", "Argo", "CI"])
    }
}
