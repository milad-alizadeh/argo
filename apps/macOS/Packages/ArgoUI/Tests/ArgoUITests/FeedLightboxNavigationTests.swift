import ArgoEngine
@testable import ArgoUI
import SwiftUI
import Testing

/// Arrow-key navigation between the pictures in a gallery, from the lightbox's request down to
/// the shot it lands on (#1226).
@MainActor
@Suite("Lightbox arrow-key navigation")
struct FeedLightboxNavigationTests {
    private static func shot(_ name: String) -> FeedShot {
        FeedShot(
            name: name,
            address: "/tmp/\(name).png",
            media: MediaEvidence(tier: .direct, mediaType: "image/png", bytes: nil),
        )
    }

    private static func selection(lit: FeedShot?) -> (FeedRowSelection, Binding<FeedShot?>) {
        var current = lit
        let focus = FocusState<FeedFocus?>()
        let binding = Binding(get: { current }, set: { current = $0 })
        return (
            FeedRowSelection(
                open: .constant(nil),
                step: .constant(nil),
                lit: binding,
                focus: focus.projectedValue,
            ),
            binding,
        )
    }

    @Test
    func `stepping forward moves to the next shot in the same gallery`() {
        let shots = [Self.shot("a"), Self.shot("b"), Self.shot("c")]
        let feed = [FeedRow(id: 0, content: .gallery(FeedGallery(shots: shots)))]
        let (selection, lit) = Self.selection(lit: shots[0])

        selection.stepLightbox(by: 1, within: feed)

        #expect(lit.wrappedValue == shots[1])
    }

    @Test
    func `stepping backward moves to the previous shot`() {
        let shots = [Self.shot("a"), Self.shot("b"), Self.shot("c")]
        let feed = [FeedRow(id: 0, content: .gallery(FeedGallery(shots: shots)))]
        let (selection, lit) = Self.selection(lit: shots[2])

        selection.stepLightbox(by: -1, within: feed)

        #expect(lit.wrappedValue == shots[1])
    }

    /// Clamped rather than wrapping: an arrow key at the last picture should stop, not loop the
    /// reader back around unannounced.
    @Test
    func `stepping past the last shot holds still`() {
        let shots = [Self.shot("a"), Self.shot("b")]
        let feed = [FeedRow(id: 0, content: .gallery(FeedGallery(shots: shots)))]
        let (selection, lit) = Self.selection(lit: shots[1])

        selection.stepLightbox(by: 1, within: feed)

        #expect(lit.wrappedValue == shots[1])
    }

    @Test
    func `stepping before the first shot holds still`() {
        let shots = [Self.shot("a"), Self.shot("b")]
        let feed = [FeedRow(id: 0, content: .gallery(FeedGallery(shots: shots)))]
        let (selection, lit) = Self.selection(lit: shots[0])

        selection.stepLightbox(by: -1, within: feed)

        #expect(lit.wrappedValue == shots[0])
    }

    /// A picture no row in the current feed carries takes no step — the same guard `darken`
    /// answers when a live transcript grows out from under an open lightbox.
    @Test
    func `a shot no row in the feed carries takes no step`() {
        let shots = [Self.shot("a"), Self.shot("b")]
        let feed = [FeedRow(id: 0, content: .gallery(FeedGallery(shots: shots)))]
        let stray = Self.shot("z")
        let (selection, lit) = Self.selection(lit: stray)

        selection.stepLightbox(by: 1, within: feed)

        #expect(lit.wrappedValue == stray)
    }
}
