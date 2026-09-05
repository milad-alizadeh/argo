import AppKit
import ArgoAtoms
import ArgoDesign
@testable import ArgoUI
import MermaidLayout
import MermaidView
import SwiftUI
import Testing

/// That a wheel over a block that scrolls across still scrolls the reading behind it (#1385).
///
/// The claim cannot be made from either side alone, so the suite hosts the real nesting — a block
/// inside a scroller standing for the feed's — and lets AppKit's own hit test pick the view the
/// event goes to. Both of the feed's across-scrolling blocks are asked the same three questions: a
/// wheel down the page reaches the reading, a wheel across it does not, and a click reaches the
/// words.
@Suite("Wheel passthrough over a block that scrolls across")
@MainActor
struct ScrollAcrossWheelTests {
    @Test(arguments: ScrollAcrossBlock.allCases)
    func `a wheel down the page reaches the reading behind the block`(
        kind: ScrollAcrossBlock,
    ) throws {
        let hosted = try HostedBlock(kind)
        try hosted.wheel(byX: 0, byY: -10)
        #expect(
            hosted.behind.wheels == 1,
            """
            A wheel down the page over a \(kind) never reached the scroller behind it, so the \
            reading stops under the pointer and the reader has to move off the block to carry on \
            (#1385).
            """,
        )
    }

    @Test(arguments: ScrollAcrossBlock.allCases)
    func `a wheel across the page moves the block, not the reading`(
        kind: ScrollAcrossBlock,
    ) throws {
        let hosted = try HostedBlock(kind)
        let taken = try hosted.wheel(byX: -10, byY: 0)
        #expect(
            hosted.behind.wheels == 0,
            """
            A wheel across the page over a \(kind) was handed to the reading behind it, which \
            spends it on nothing: the reading only scrolls down.
            """,
        )
        #expect(
            try hosted.isInsideItsOwnScroller(taken),
            """
            A wheel across the page over a \(kind) was answered by something outside the block's \
            own scroller, so the part of the block past the column can no longer be reached \
            (#1385).
            """,
        )
    }

    /// The other half of the yield: it takes wheels and nothing else. Without this the fix reads as
    /// a fix and quietly costs the reader every click into the block — the words are selectable,
    /// and a view that answered a mouse-down would be the one selecting them.
    @Test(arguments: ScrollAcrossBlock.allCases)
    func `a click over the block reaches the words, not the yield`(
        kind: ScrollAcrossBlock,
    ) throws {
        let hosted = try HostedBlock(kind)
        let clicked = try hosted.hit(whileHandling: HostedBlock.clickEvent())
        #expect(
            !(clicked is ArgoWheelYieldView),
            """
            A hit test with a mouse-down in flight was answered by the wheel yield, so it stands \
            in front of the \(kind) for every event — and its words can no longer be selected.
            """,
        )
    }
}

/// One of the feed's across-scrolling blocks, hosted inside a scroller that counts what it is
/// handed — the feed's nesting, in the small.
@MainActor private struct HostedBlock {
    let behind: WheelCountingScrollView
    let host: NSView
    let window: NSWindow
    private let yield: ArgoWheelYieldView

    init(_ kind: ScrollAcrossBlock) throws {
        let host = NSHostingView(rootView: Self.block(kind).argoAppearance())
        self.host = host
        host.frame = NSRect(x: 0, y: 0, width: 400, height: 400)
        self.behind = WheelCountingScrollView(frame: host.frame)
        behind.hasVerticalScroller = true
        behind.documentView = host
        self.window = NSWindow(
            contentRect: behind.frame,
            styleMask: [.titled], backing: .buffered, defer: false,
        )
        window.contentView = behind
        window.layoutIfNeeded()
        host.layoutSubtreeIfNeeded()
        self.yield = try #require(
            Self.find(ArgoWheelYieldView.self, in: host),
            "The \(kind) built no wheel yield, so it still swallows the reading's wheel.",
        )
    }

    @ViewBuilder private static func block(_ kind: ScrollAcrossBlock) -> some View {
        switch kind {
        case .fence:
            FeedMarkdownFence(code: code, info: "swift")
        case .diagram:
            MermaidDiagram.read(diagram).map(MermaidView.init(diagram:))
        }
    }

    /// One wheel event, dispatched the way a window dispatches one: AppKit's own hit test picks the
    /// view, and that view is asked to handle it.
    @discardableResult func wheel(byX: CGFloat, byY: CGFloat) throws -> NSView? {
        let event = try #require(
            Self.wheelEvent(byX: byX, byY: byY), "The suite could not make a scroll wheel event.",
        )
        let taken = try hit(whileHandling: event)
        taken?.scrollWheel(with: event)
        return taken
    }

    /// The view AppKit's hit test picks with `event` in flight. The yield is told which event that
    /// is first, because `NSApp.currentEvent` is set by a dispatch no suite runs.
    @discardableResult func hit(whileHandling event: NSEvent) throws -> NSView? {
        yield.eventInFlight = { event }
        defer { yield.eventInFlight = { NSApp.currentEvent } }
        return try #require(window.contentView, "The window holds no scroller.")
            .hitTest(Self.pointer)
    }

    /// Whether the event went to the block's own scroller. Where a wheel LANDS is what a suite can
    /// state; how far a `ScrollView` then travels is SwiftUI's, and it does not answer a synthetic
    /// event outside a real dispatch at all.
    func isInsideItsOwnScroller(_ view: NSView?) throws -> Bool {
        let across = try #require(
            Self.find(NSScrollView.self, in: host), "The block built no scroller of its own.",
        )
        return view.map { across.isDescendant(of: $0) || $0.isDescendant(of: across) } ?? false
    }

    /// The middle of the hosted block, in the window's coordinates.
    private static let pointer = NSPoint(x: 200, y: 200)

    /// A press, for the claim that a press is not taken. Its location is the pointer's, because a
    /// mouse event with no location is one AppKit would never have hit-tested here.
    static func clickEvent() -> NSEvent {
        NSEvent.mouseEvent(
            with: .leftMouseDown, location: pointer, modifierFlags: [], timestamp: 0,
            windowNumber: 0, context: nil, eventNumber: 0, clickCount: 1, pressure: 1,
        ) ?? NSEvent()
    }

    private static func wheelEvent(byX: CGFloat, byY: CGFloat) -> NSEvent? {
        CGEvent(
            scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 2,
            wheel1: Int32(byY), wheel2: Int32(byX), wheel3: 0,
        ).flatMap(NSEvent.init(cgEvent:))
    }

    private static func find<V: NSView>(_ kind: V.Type, in view: NSView) -> V? {
        if let hit = view as? V {
            return hit
        }
        for child in view.subviews {
            if let found = find(kind, in: child) {
                return found
            }
        }
        return nil
    }

    /// Long enough lines that the block has somewhere to go across, so a wheel across the page is
    /// one it can actually spend.
    private static let code = """
    public static let inset: CGFloat = ArgoSpacing.section // a comment long enough to overflow it
    let another = "a second line, so the block is taller than one and wider than its own column"
    """

    /// A flowchart wide enough to do the same.
    private static let diagram = """
    flowchart LR
      A[The first box] --> B[The second box] --> C[The third] --> D[The fourth] --> E[The fifth]
    """
}

/// Which block is under the pointer. Both are `ArgoScrollAcross` and both stand in the same feed,
/// so a fix that reached only one of them would leave the reported dead spot in the reading.
enum ScrollAcrossBlock: CaseIterable, CustomStringConvertible {
    case fence
    case diagram

    var description: String {
        switch self {
        case .fence: "code block"
        case .diagram: "diagram"
        }
    }
}

/// A scroller standing for the feed's, counting the wheels that reach it.
@MainActor private final class WheelCountingScrollView: NSScrollView {
    private(set) var wheels = 0

    override func scrollWheel(with event: NSEvent) {
        wheels += 1
        super.scrollWheel(with: event)
    }
}
