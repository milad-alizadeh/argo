import ArgoDesign
import MermaidView
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

    var body: some View {
        switch block {
        case let .fenced(code, info):
            FeedMarkdownFence(code: code, info: info)
        case let .diagram(diagram):
            MermaidView(diagram: diagram)
        case let .table(table):
            FeedMarkdownTable(table: table)
        // Words, which the surface inks. Reached only where the two readings of one string came
        // apart, which nothing has ever seen them do.
        case .paragraph, .heading, .bullet, .numbered:
            EmptyView()
        }
    }
}
