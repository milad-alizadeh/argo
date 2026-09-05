import ArgoDesign
import SwiftUI

/// The way a Session gets put on a Ticket (#1092, #1231): a small searchable picker over the open
/// backlog, worked from the keyboard alone.
///
/// It replaces a menu that listed every open Ticket as a row of its own. That menu grew with the
/// backlog until it filled almost the window, and finding one Ticket meant reading many. This one
/// is measured at `ArgoTicketPicker` and stays that size whatever the backlog does.
///
/// The composer's `/` and `@` menus are where this shape comes from — a query, a cursor held over
/// the FILTERED ids, and a list that scrolls under its own ceiling. `MenuCursor` is the piece
/// itself, shared rather than re-derived. What differs is the field: the composer types into the
/// draft, so its menu must not take focus, while this one is opened for typing and nothing else.
///
/// A `View` taking its data as a parameter rather than a `@ViewBuilder` on the caller
/// (`rules/swift.md` — Views): the offering is what this draws, so it is what it takes.
package struct SessionTicketPicker: View {
    let linking: SessionTicketLinking
    /// Close the surface this stands in. Called on a pick and on Escape alike — a picker that
    /// linked a Ticket and stayed open would leave the reader looking at a list of what they no
    /// longer need.
    let close: () -> Void

    @State private var query: String
    /// Held over the filtered numbers, so a query that narrows past the cursor's row moves it
    /// back to the top rather than leaving Return on a Ticket nobody can see.
    @State private var cursor = MenuCursor<Int>()

    /// Spelled out: Swift synthesises no memberwise initializer above `internal`, and the
    /// specimens build this from their own target. `query` is seeded so a render can show the
    /// picker mid-search, which is the state the ticket is about.
    package init(
        linking: SessionTicketLinking,
        query: String = "",
        close: @escaping () -> Void = {},
    ) {
        self.linking = linking
        _query = State(initialValue: query)
        self.close = close
    }

    package var body: some View {
        VStack(spacing: ArgoSpacing.flush) {
            SessionTicketPickerField(query: $query, press: press)
            Divider()
            SessionTicketPickerList(matches: matches, current: cursor.current, pick: link)
        }
        .frame(width: ArgoTicketPicker.width)
        .padding(.vertical, ArgoSpacing.tight)
        .onAppear { cursor.settle(over: numbers) }
        .onChange(of: query) { cursor.settle(over: numbers) }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(Self.label)
    }

    /// Derived per render rather than stored: the query is the only state here, and a second copy
    /// of what it narrows to is a copy that can disagree with it.
    private var matches: [SessionTicketSearch.Match] {
        SessionTicketSearch.matches(over: linking.options, on: query)
    }

    private var numbers: [Int] {
        matches.map(\.id)
    }

    /// Every key the field hands over, off ONE switch: a fifth fails to compile here rather than
    /// being quietly swallowed by a default arm.
    private func press(_ key: SessionTicketPickerField.Key) {
        switch key {
        case .up: cursor.up(over: numbers)
        case .down: cursor.down(over: numbers)
        // Nothing under the cursor is nothing to link, so Return closes nothing and links
        // nothing — the reader is still mid-query, and the field keeps their characters.
        case .commit: if let number = cursor.current { link(number) }
        case .dismiss: close()
        }
    }

    private func link(_ number: Int) {
        linking.link(number)
        close()
    }

    /// What a screen reader calls the surface — the act, because that is what opening it is for.
    static let label = "Link this Session to a Ticket"
}

#Preview("Session ticket picker — whole backlog, a query, nothing matched") {
    let linking = SessionTicketLinking(options: [
        .init(number: 1231, title: "Link a ticket opens the whole backlog"),
        .init(number: 1217, title: "Anchor the feed on its newest line"),
        .init(number: 1092, title: "Route between Session and Ticket"),
    ])

    return HStack(alignment: .top, spacing: ArgoSpacing.loose) {
        SessionTicketPicker(linking: linking)
        SessionTicketPicker(linking: linking, query: "1217")
        SessionTicketPicker(linking: linking, query: "zzz")
    }
    .padding(ArgoSpacing.loose)
    .argoDeckSurface()
    .argoAppearance()
}
