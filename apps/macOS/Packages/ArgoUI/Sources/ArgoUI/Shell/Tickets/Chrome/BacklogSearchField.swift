import ArgoDesign
import SwiftUI

/// Search, at the row's trailing edge — **a real field, not an icon that becomes one.**
///
/// It stands in for `.searchable`, which is not used here for one reason: the system's field takes
/// the width the toolbar gives it, and this one is measured at `ArgoTicketsChrome.searchWidth` so
/// it clears the trailing edge at the 1280 window. Everything else about it is the stock field —
/// focus, the escape key, and the system's own clear button.
///
/// The line inside the capsule is `SearchFieldLine`, shared with the ticket picker's own field
/// (#1231). What is left here is the capsule and the width.
///
/// **It stands exactly as tall as the icon vessels beside it** — `ArgoControlBox.vessel`, the same
/// number a capsule holding one mark comes out at. It had a 28 of its own, which made the one row
/// of controls three heights of container; a field is a container on this band like any other.
///
/// **Since #1317 it also FINDS a question in what was typed**, and offers to ask it. The ask is
/// found and never switched to: there is no second control, no mode toggle, and `⏎` still
/// searches. A reader who never notices it has lost nothing, and the only thing that changes is
/// the leading mark and the width.
package struct BacklogSearchField: View {
    @Binding var query: String
    /// How wide the list pane is right now — the edge the field has to clear while it is holding a
    /// question. The PANE's and not the window's: #1242 put this field on the pane's own band, and
    /// the reader can drag that pane's seam.
    var pane: CGFloat = ArgoBacklogList.width
    /// What `⌘⏎` sends. Inert by default, so a preview and a specimen draw the field with no port
    /// behind it.
    var ask: () -> Void = {}
    /// Whether the field takes key focus as it appears. `false` in the app — a band nobody pressed
    /// must not steal the keyboard — and `true` in a RENDER, which is the only way a still can
    /// show the field as the reader who typed into it sees it.
    ///
    /// It is what makes the TAIL visible: an unfocused `TextField` draws from its head, and a
    /// still of the head is a still of the half the reader is not editing. The design decides
    /// that, and asserting it in a comment while rendering the other half is how it went unnoticed
    /// (#1317, pixel review).
    var opensFocused = false

    @Environment(\.argoReduceMotion) private var reduceMotion

    /// Spelled out: Swift synthesises no memberwise initializer above `internal`, and the
    /// specimens build this from their own target (#1085).
    package init(
        query: Binding<String>,
        pane: CGFloat = ArgoBacklogList.width,
        ask: @escaping () -> Void = {},
        opensFocused: Bool = false,
    ) {
        _query = query
        self.pane = pane
        self.ask = ask
        self.opensFocused = opensFocused
    }

    /// Whether what is typed reads as a question. One read, handed to both the mark and the width,
    /// so the field cannot wear the wand at the search width or the other way round.
    private var asks: Bool {
        BacklogQueryIntentProjection.kind(of: query) == .question
    }

    /// The two widths, off the one reading above. A property rather than a ternary in the frame:
    /// the term width is a constant and the question width is derived from the pane, and the line
    /// that had to hold both was the one the formatter broke across `ArgoTicketsChrome`.
    private var width: CGFloat {
        asks ? ArgoTicketsChrome.askWidth(inPaneOf: pane) : ArgoTicketsChrome.searchWidth
    }

    package var body: some View {
        SearchFieldLine(
            query: $query,
            look: SearchFieldLine.Look(prompt: Self.prompt, lead: asks ? .ask : .search),
            opensFocused: opensFocused,
            // `asks` as well as the key: `⌘⏎` over a plain TERM would otherwise open a wait for
            // an ask the surface never offered, which is the press-that-does-nothing one worse
            // (#872, #900).
            press: {
                if $0 == .ask, asks {
                    ask()
                }
            },
        )
        // The TAIL of a question is what a FOCUSED field draws: AppKit scrolls the insertion
        // point into view, and the caret is at the end of what was typed. Unfocused it draws from
        // the head — which is why `opensFocused` exists above and why a render sets it.
        .frame(width: width)
        .argoFloatingGlass(in: .capsule)
        .animation(ArgoMotion.stateChange.resolved(reduceMotion: reduceMotion), value: asks)
    }

    static let prompt = "Search the backlog"
}

// Empty, which is the state every render of this room shows and the one the 210 was measured
// against — a typed TERM is the same field at the same width (`apps/macOS/AGENTS.md`, coverage).
#Preview("Backlog search field") {
    @Previewable @State var query = ""

    BacklogSearchField(query: $query)
        .padding(ArgoSpacing.region)
        .argoAppearance()
}

// The other width, and the other mark. Its own preview because they are one state and not two: a
// field wearing the wand at 210 would be the bug this pairs them to prevent.
#Preview("Backlog search field — holding a question") {
    @Previewable @State var query = "is there a ticket for the fold state bug?"

    BacklogSearchField(query: $query, opensFocused: true)
        .padding(ArgoSpacing.region)
        .argoAppearance()
}
