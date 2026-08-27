import SwiftUI

/// A surface's code under the grammar, with the colours' single owner.
///
/// The surface says what to read and draws the answer. It holds no state, builds no identity for
/// the request and cannot index past the end of the run — the three things each of the three
/// surfaces that colour code used to do for itself.
struct SyntaxColoured<Content: View>: View {
    private let request: SyntaxRequest
    private let content: (SyntaxColouring.Reading) -> Content

    @State private var colouring = SyntaxColouring.plain

    init(
        _ request: SyntaxRequest,
        @ViewBuilder content: @escaping (SyntaxColouring.Reading) -> Content,
    ) {
        self.request = request
        self.content = content
    }

    var body: some View {
        content(colouring.over(request))
            .task(id: request) { colouring = await SyntaxColouring(of: request) }
    }
}
