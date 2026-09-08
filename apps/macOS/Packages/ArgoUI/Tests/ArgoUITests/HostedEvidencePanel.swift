import AppKit
import ArgoEngine
@testable import ArgoUI
import SwiftUI
import Testing

/// One `EvidencePanel` hosted for real, wired the way `DeckContentRow` wires it: what the panel
/// reports is written straight back as its `current`, so the two directions can fight if the
/// guards let them.
///
/// The precedent for hosting at all is `HostedDeck` — a claim about the seam between a SwiftUI
/// scroll view and what it reports upward cannot be made from either side alone.
@MainActor final class HostedEvidencePanel {
    /// What the panel told the feed, as `FeedRowSelection.scrolled(to:)` receives it.
    @Observable final class Told {
        var step: Int?
    }

    private let told = Told()
    private let host: NSHostingView<AnyView>
    /// Held for the life of the harness: a hosting view lays out in a window, and the panel's
    /// scroller is the window's to build.
    let window: NSWindow

    /// The panel at the floor of its own zone, and SHORTER than one of its steps — which is what
    /// makes `a scroll to the foot reports the last step` exact.
    private static let size = CGSize(width: 360, height: 320)
    /// Lines per step, chosen so one step is taller than the view above.
    private static let linesPerStep = 40

    init(steps: Int) {
        self.host = NSHostingView(rootView: AnyView(
            HostedEvidenceWrapper(told: told, evidence: Self.evidence(steps: steps))
                .frame(width: Self.size.width, height: Self.size.height)
                .argoAppearance(),
        ))
        host.frame = NSRect(origin: .zero, size: Self.size)
        self.window = NSWindow(
            contentRect: host.frame,
            styleMask: [.titled],
            backing: .buffered,
            defer: false,
        )
        window.contentView = host
        host.layoutSubtreeIfNeeded()
    }

    var reported: Int? {
        told.step
    }

    /// The panel's own scroller, which SwiftUI built for its `ScrollView`.
    func scroller() throws -> NSScrollView {
        try #require(
            HostedDeck.find(NSScrollView.self, in: host), "The hosted panel built no scroller.",
        )
    }

    func documentHeight() throws -> CGFloat {
        try #require(scroller().documentView, "The panel's scroller holds no document.").frame
            .height
    }

    func offset() throws -> CGFloat {
        try scroller().contentView.bounds.origin.y
    }

    /// The reader's own scroll: where it LANDED, read before anything could answer it, and where
    /// it stands once everything has. A claim about the panel staying put needs both, because a
    /// `scrollTo` answering the panel's own report resolves inside the settle and a single reading
    /// taken afterwards already carries it.
    @discardableResult
    func scrolled(to offset: CGFloat) async throws -> (landed: CGFloat, stayed: CGFloat) {
        await settled()
        let scroller = try scroller()
        scroller.contentView.scroll(to: NSPoint(x: 0, y: offset))
        scroller.reflectScrolledClipView(scroller.contentView)
        let landed = scroller.contentView.bounds.origin.y
        await settled()
        return (landed, scroller.contentView.bounds.origin.y)
    }

    /// Turns the run loop until the panel has stopped moving AND stopped reporting.
    ///
    /// Bounded and on the condition, never a turn count: a fixed wait passes on an idle machine
    /// and fails alone, which is the rule `FeedTableFixture.settledForReading` states. The floor
    /// is there because the pair reads as still before the first layout has run at all.
    func settled() async {
        var last: (CGFloat, Int?)?
        for turn in 0 ..< Self.turns {
            settle()
            try? await Task.sleep(for: .milliseconds(2))
            let now = ((try? offset()) ?? 0, told.step)
            if turn >= Self.floor, let last, last == now {
                return
            }
            last = now
        }
        Issue.record("the panel never stopped moving across \(Self.turns) turns")
    }

    /// One turn of the run loop and one layout. Separate because `RunLoop.run(_:before:)` is
    /// unavailable from an `async` context, and the panel's report comes off a preference that a
    /// layout pass is what recomputes.
    func settle() {
        RunLoop.current.run(mode: .default, before: Date(timeIntervalSinceNow: 0.002))
        host.layoutSubtreeIfNeeded()
    }

    private static let turns = 200
    private static let floor = 6

    /// A run of results, each taller than the view they are read in.
    static func evidence(steps: Int) -> FeedEvidence {
        FeedEvidence(
            verb: "Ran",
            symbol: "›",
            label: "Ran \(steps) Commands",
            ending: .succeeded,
            steps: (0 ..< steps).map { index in
                FeedEvidence.Step(
                    id: index,
                    address: .typed("say-\(index)"),
                    language: nil,
                    isExternal: false,
                    result: .output(OutputEvidence(
                        tier: .direct,
                        text: (0 ..< linesPerStep)
                            .map { "line \(index)-\($0)" }
                            .joined(separator: "\n"),
                    )),
                )
            },
        )
    }
}

/// `DeckContentRow.panel`'s wiring, and only that: `current` in, the report written back onto it.
private struct HostedEvidenceWrapper: View {
    let told: HostedEvidencePanel.Told
    let evidence: FeedEvidence

    /// The deck's `FeedRowSelection.step`, held as the state it is above the panel.
    @State private var current: Int?

    var body: some View {
        EvidencePanel(evidence: evidence, current: current, onScroll: reported)
    }

    private func reported(_ step: Int) {
        told.step = step
        current = step
    }
}
