import AppKit
import ArgoDesign
@testable import ArgoUI
import ProseText
import Testing

/// A link opens where its words are DRAWN, and nowhere else (ADR-0030, Rule 8).
///
/// The rectangles come off the very frame the surface inked, so this suite is the whole of what
/// "hit-tested on the frame" buys: a press inside a link's own glyphs opens that link, a press an
/// inch away opens nothing, and a link that wrapped answers on both of its lines.
@MainActor
@Suite("Prose links")
struct ProseLinkHitTests {
    private static let measure = FeedRowMeasure.measure(atWidth: 620)

    private static func surface(_ text: String) -> ProseSurface {
        let surface = ProseSurface()
        surface.show(
            ProseShowing(text: text, measure: measure, ink: ink),
            theme: .graphite,
        )
        return surface
    }

    private static var ink: ProseInk {
        let palette = ArgoPalette.graphite
        return ProseInk(
            body: palette.text.primary,
            link: palette.interaction.accent,
            span: nil,
            marked: ProseMarkedInk(
                ground: palette.surface.marked,
                inset: CGSize(width: 3, height: 1),
                radius: 4,
            ),
        )
    }

    @Test
    func `a press inside a link's words opens that link`() {
        let surface = Self.surface("The suite is green, per [ADR-0021](https://example.com/adr).")
        let place = try? #require(surface.links.first)
        #expect(surface.links.count == 1)
        #expect(place?.url.absoluteString == "https://example.com/adr")
        let inside = CGPoint(x: place?.rect.midX ?? 0, y: place?.rect.midY ?? 0)
        #expect(surface.link(at: inside) == place?.url)
    }

    @Test
    func `a press outside every link opens nothing`() {
        let surface = Self.surface("The suite is green, per [ADR-0021](https://example.com/adr).")
        let place = surface.links.first
        #expect(surface.link(at: CGPoint(x: 2, y: 2)) == nil)
        #expect(surface.link(at: CGPoint(x: (place?.rect.maxX ?? 0) + 24, y: 2)) == nil)
    }

    /// Two links in one row, each answering for its own words — the case a single rectangle over
    /// the whole paragraph would pass and a reader would not.
    @Test
    func `each link answers for its own words`() {
        let surface = Self.surface(
            "See [one](https://example.com/one) and then [two](https://example.com/two).",
        )
        #expect(surface.links.count == 2)
        for place in surface.links {
            #expect(surface.link(at: CGPoint(x: place.rect.midX, y: place.rect.midY)) == place.url)
        }
        let first = surface.links.first
        let second = surface.links.last
        #expect(first?.url != second?.url)
    }

    /// A link inside a list item is offset by the marker column, and a press has to land on the
    /// words rather than where they would have been without it.
    @Test
    func `a link inside a list item is placed past its marker`() {
        let surface = Self.surface("- see [the record](https://example.com/record)")
        let place = surface.links.first
        #expect((place?.rect.minX ?? 0) >= ArgoFeedRow.markerWidth)
        #expect(surface.link(
            at: CGPoint(x: place?.rect.midX ?? 0, y: place?.rect.midY ?? 0),
        ) == place?.url)
    }

    /// Every rectangle sits inside the row's own frame: a link drawn past the foot would be a link
    /// pressed on the row below.
    @Test
    func `every link rectangle sits inside the row`() {
        let surface = Self.surface(
            "A paragraph long enough to wrap more than once before it reaches "
                + "[a link near the end of it](https://example.com/end) and carries on afterwards.",
        )
        #expect(!surface.links.isEmpty)
        for place in surface.links {
            #expect(place.rect.minY >= 0)
            #expect(place.rect.maxY <= surface.placed.height + 0.01)
            #expect(place.rect.maxX <= Self.measure + 0.01)
        }
    }
}
