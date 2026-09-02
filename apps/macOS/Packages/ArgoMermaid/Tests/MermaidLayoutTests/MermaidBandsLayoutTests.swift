import Foundation
@testable import MermaidLayout
import ProseText
import Testing

/// Where a journey and a timeline are placed — one layout, so the claims are made over both.
///
/// The claims are the ones a reader would make with their eyes on it: bands along the axis, a
/// heading per column standing on one line, and everything under a heading stacked clear of
/// everything else.
@MainActor
@Suite("Mermaid banded layout")
struct MermaidBandsLayoutTests {
    nonisolated static let journey = """
    journey
      title A working day
      section Morning
        Make tea: 5: Me
        Read the ticket: 3: Me, Argo
      section Afternoon
        Wait on CI: 1: CI
    """

    nonisolated static let timeline = """
    timeline
      title A history of the feed
      section 2000s
        2002 : LinkedIn
        2004 : Facebook : Google
      section 2010s
        2010 : Instagram
    """

    static func plan(_ source: String) -> MermaidPlan {
        MermaidDiagram.read(source)?.laid ?? .empty
    }

    static func rects(of plan: MermaidPlan, named text: String) -> [CGRect] {
        plan.captions.filter { $0.label.text == text }.map(\.rect)
    }

    /// The captions the plan places and the labels the view builds are paired by POSITION, so the
    /// two lists saying the same words in the same order is the contract between them.
    @Test(arguments: [journey, timeline])
    func `the captions are the model's labels, in that order`(source: String) throws {
        let diagram = try #require(MermaidDiagram.read(source))

        #expect(diagram.laid.captions.map(\.label) == diagram.labels)
    }

    /// One layout serves both, so the property that keeps a stack readable is asserted over both:
    /// nothing a banded diagram writes is drawn over anything else it writes.
    @Test(arguments: [journey, timeline])
    func `no two things a banded diagram writes overlap`(source: String) {
        let rects = Self.plan(source).captions.map(\.rect)

        #expect(!rects.isEmpty)
        for (at, rect) in rects.enumerated() {
            #expect(!rects[(at + 1)...].contains { $0.intersects(rect) })
        }
    }

    /// A band is a strip along the axis carrying its own name, so the strip stands above every
    /// column of that band and reaches across all of them.
    @Test(arguments: [journey, timeline])
    func `a section is a band drawn across the columns under it`(source: String) throws {
        let plan = Self.plan(source)
        let strip = try #require(plan.captions.dropFirst().first)
        let headings = plan.captions.filter { $0.label.face == ProseFace.body }.map(\.rect)

        #expect(!headings.isEmpty)
        #expect(headings.allSatisfy { $0.minY >= strip.rect.maxY })
        #expect(headings.filter { $0.minX < strip.rect.maxX }
            .allSatisfy { strip.rect.contains(CGPoint(x: $0.midX, y: strip.rect.midY)) })
    }

    /// Every column's heading stands on one line whichever band it is in, which is what makes the
    /// axis read as an axis rather than as a row of unrelated boxes.
    @Test(arguments: [journey, timeline])
    func `every heading stands on one line across the whole axis`(source: String) {
        let headings = Self.plan(source).captions
            .filter { $0.label.face == ProseFace.body }.map(\.rect)

        #expect(Set(headings.map(\.minY)).count == 1)
        #expect(Set(headings.map(\.height)).count == 1)
    }

    /// The acceptance criterion in its own words: a period carrying several events lays them out
    /// without overlap, one under the other and under their own period.
    @Test
    func `a period stacks its events under it without overlap`() throws {
        let plan = Self.plan(Self.timeline)
        let period = try #require(Self.rects(of: plan, named: "2004").first)
        let facebook = try #require(Self.rects(of: plan, named: "Facebook").first)
        let google = try #require(Self.rects(of: plan, named: "Google").first)

        #expect(facebook.minY >= period.maxY)
        #expect(google.minY >= facebook.maxY)
        #expect(!facebook.intersects(google))
    }

    /// A timeline that never says `section` still draws, and draws no strip for a band nobody
    /// named.
    @Test
    func `a timeline with no sections draws its periods and no band`() {
        let plan = Self.plan("timeline\n2002 : LinkedIn\n2004 : Facebook")

        #expect(plan.captions.map(\.label.text) == ["2002", "LinkedIn", "2004", "Facebook"])
        #expect(plan.size.height > 0)
        #expect(plan.captions.allSatisfy { $0.rect.minY >= 0 })
    }

    /// Multiple actors on one task are ALL shown, each in its own chip under the task.
    @Test
    func `every actor a task names is drawn under it`() throws {
        let plan = Self.plan(Self.journey)
        let task = try #require(Self.rects(of: plan, named: "Read the ticket").first)

        #expect(Self.rects(of: plan, named: "Me").count == 2)
        #expect(Self.rects(of: plan, named: "Argo").count == 1)
        #expect(Self.rects(of: plan, named: "Argo").allSatisfy { $0.minY >= task.maxY })
    }

    /// One actor is one hue wherever the journey names them, which is what lets a reader read a
    /// chip back to a person.
    @Test
    func `an actor named on two tasks takes one hue`() {
        let plan = Self.plan(Self.journey)
        let roles = plan.captions.filter { $0.label.text == "Me" }.map(\.label.role)

        #expect(roles == [.series(0), .series(0)])
        #expect(plan.captions.filter { $0.label.text == "Argo" }.map(\.label.role) == [.series(1)])
    }

    /// The score reads as a rating and not as a number: one step per point of mermaid's scale, lit
    /// up to the score.
    @Test(arguments: [("Make tea: 5: Me", 5), ("Wait on CI: 1: CI", 1), ("Read: 3: Me", 3)])
    func `a task shows its score as steps lit on mermaid's scale`(row: String, score: Int) {
        let steps = Self.plan("journey\n" + row).figures.filter {
            guard case .path = $0.form else { return false }
            return true
        }

        #expect(steps.count == MermaidJourney.scale)
        #expect(steps.filter { $0.role == .emphasis }.count == score)
        // Lit and unlit differ in weight as well as in ink, so the rating reads as filled rather
        // than as five marks in two colours.
        #expect(steps.filter { $0.line == .thick }.count == score)
        // What is not lit is the rest of the scale rather than a mark of its own — the ink an axis
        // is drawn in, not the ink a connector is.
        #expect(steps.filter { $0.role == .axis }.count == MermaidJourney.scale - score)
    }

    /// The rating is the one mark of a banded diagram with no caption, so the invariant every
    /// captioned box is held to has to be asserted for it by hand: it stands under its own heading
    /// and clear of the chips below.
    @Test
    func `the rating stands between the heading above it and the actors below`() throws {
        let plan = Self.plan("journey\nRead the ticket: 3: Me")
        let heading = try #require(Self.rects(of: plan, named: "Read the ticket").first)
        let actor = try #require(Self.rects(of: plan, named: "Me").first)
        let steps = plan.figures.compactMap { figure -> CGRect? in
            guard case .path = figure.form else { return nil }
            return figure.form.bounds
        }

        #expect(steps.count == MermaidJourney.scale)
        #expect(steps.allSatisfy { $0.minY >= heading.maxY && $0.maxY <= actor.minY })
    }

    /// The plan is what the view frames itself at and what the lane reports, so a diagram that
    /// laid out to nothing would be a row of no height (#860).
    @Test(arguments: [journey, timeline])
    func `a banded diagram stands at a size the view can frame`(source: String) {
        let size = Self.plan(source).size

        #expect(size.width > 0)
        #expect(size.height > 0)
    }
}
