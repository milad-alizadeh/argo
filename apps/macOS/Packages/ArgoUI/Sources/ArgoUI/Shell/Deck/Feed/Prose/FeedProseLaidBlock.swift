import ArgoDesign
import MermaidView
import ProseText
import SwiftUI

/// A block that lays ITSELF out, drawn by the view that already draws it: a fence's ground and its
/// scrollable code, a pipe table's rules, a diagram.
///
/// Hosted by `ProseSurface` at the frame the measure gave it, rather than inked there. Each of
/// these states its own size through its own layout, so none is glyphs the surface could set — and
/// each carries an interaction the surface has no way to keep: a fence scrolls sideways, a table's
/// cells wrap, a diagram's captions are selectable.
///
/// Words never reach here. A paragraph, a heading and a list item are `ProseSurface`'s own.
struct FeedProseLaidBlock: View {
    let block: MarkdownBlock
    /// The voice the words INSIDE it take, where it holds any — a table's cells (#1597).
    ///
    /// Handed in rather than inherited: each of these is hosted in its own view tree, so nothing
    /// the surface's caller set reaches here, and a cell left to the platform's own label colour
    /// was drawn at no rung of the ramp at all. A fence and a picture ink their own words and
    /// take no notice of this.
    let voice: ProseVoice

    var body: some View {
        drawn
            .foregroundStyle(voice.ink.color)
            .environment(\.proseVoice, .one(voice.ink))
    }

    @ViewBuilder private var drawn: some View {
        switch block {
        case let .fenced(code, info):
            FeedMarkdownFence(code: code, info: info)
        case let .diagram(diagram):
            MermaidView(diagram: diagram)
        case let .table(table):
            FeedMarkdownTable(table: table)
        case let .picture(alt, source):
            FeedMarkdownPicture(alt: alt, source: source)
        // Words, which the surface inks. Reached only where the two readings of one string came
        // apart, which nothing has ever seen them do.
        case .paragraph, .heading, .bullet, .numbered:
            EmptyView()
        }
    }
}
