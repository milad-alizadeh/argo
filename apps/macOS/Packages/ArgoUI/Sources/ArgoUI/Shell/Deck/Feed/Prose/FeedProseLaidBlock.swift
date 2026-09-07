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
    /// The ink the words INSIDE a table's cells take (#1597).
    ///
    /// Handed in rather than inherited: this is hosted in its own view tree, so nothing the
    /// surface's caller set reaches it, and a cell left to the platform's own label colour was
    /// drawn at no rung of the ramp at all. The other three blocks ink their own words.
    let prose: ArgoColor

    var body: some View {
        switch block {
        case let .fenced(code, info):
            FeedMarkdownFence(code: code, info: info)
        case let .diagram(diagram):
            MermaidView(diagram: diagram)
        case let .table(table):
            FeedMarkdownTable(table: table)
                .foregroundStyle(prose.color)
                .environment(\.proseTone, .one(prose))
        case let .picture(alt, source):
            FeedMarkdownPicture(alt: alt, source: source)
        // Words, which the surface inks. Reached only where the two readings of one string came
        // apart, which nothing has ever seen them do.
        case .paragraph, .heading, .bullet, .numbered:
            EmptyView()
        }
    }
}
