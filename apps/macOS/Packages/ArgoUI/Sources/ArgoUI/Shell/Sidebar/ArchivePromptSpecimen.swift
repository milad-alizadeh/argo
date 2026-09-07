import SwiftUI

/// The archive prompt as it is actually raised, addressable by name so it can be rendered to a PNG
/// (#1596).
///
/// It lives in `ArgoUI` rather than beside the other specimens because the prompt's parts —
/// `ArchiveConfirmation`, `ArchiveConfirmationDialog` — are internal to this module, and one
/// `package` view here is a smaller opening than making the whole prompt visible from outside. The
/// batch is named by a CASE for the same reason: the caller says which reading it wants, and the
/// Sessions behind it stay in here.
///
/// What there is to look at is the WORDS, since AppKit owns every pixel of the chrome: whether the
/// message's sentences land in the order that matters, whether a mixed batch's two counts read as
/// two facts rather than one, and whether the destructive verb still says something true where
/// nothing is going to be ended.
package struct ArchivePromptSpecimen: View {
    /// The one Argo can end, the one it cannot, and the batch that is both — the three readings a
    /// reader has to be able to tell apart from the paragraph alone.
    package enum Reading {
        case ending, outliving, mixed
    }

    /// The Sessions the prompt is over, as the gesture would have captured them. Seeded rather
    /// than reached by pressing, because the gesture needs a roster with live work on it and no
    /// screenshot drives one.
    @State private var pending: ArchiveConfirmation?

    package init(_ reading: Reading) {
        _pending = State(initialValue: ArchiveConfirmation(sessions: reading.sessions))
    }

    package var body: some View {
        // A ground rather than `Color.clear`: the dialog is drawn over whatever the window holds,
        // and a transparent one gives the render nothing to say the sheet is sitting on.
        Rectangle()
            .fill(.background)
            .modifier(ArchiveConfirmationDialog(pending: $pending) { _ in })
    }
}

private extension ArchivePromptSpecimen.Reading {
    var sessions: [ArchiveConfirmation.Session] {
        switch self {
        case .ending:
            [.init(id: "one", name: "Rebuild the roster's archived foot", endsAgent: true)]
        case .outliving:
            [.init(id: "one", name: "Rebuild the roster's archived foot", endsAgent: false)]
        case .mixed:
            [
                .init(id: "one", name: "Rebuild the roster's archived foot", endsAgent: true),
                .init(id: "two", name: "Name the Delivery header", endsAgent: true),
                .init(id: "three", name: "Fold the permission line", endsAgent: false),
            ]
        }
    }
}
