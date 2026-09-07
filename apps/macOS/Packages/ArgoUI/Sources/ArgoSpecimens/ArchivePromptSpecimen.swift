import ArgoUI
import SwiftUI

/// The archive prompt as it is actually raised, in the three readings it has (#1596).
///
/// AppKit owns every pixel of the chrome, so what a render of this is evidence about is the WORDS:
/// whether the message's sentences land in the order that matters, whether a mixed batch's two
/// counts read as two facts rather than one, and whether the destructive verb still says something
/// true where nothing is going to be ended.
struct ArchivePromptSpecimen: View {
    /// The end Argo can perform, the end it cannot, and the batch that is both — the three a
    /// reader has to be able to tell apart from the paragraph alone.
    enum Reading {
        case ending, outliving, mixed
    }

    /// Seeded open rather than reached by pressing: the gesture needs a roster with live work on
    /// it, and no screenshot drives one.
    @State private var pending: ArchiveConfirmation?

    init(_ reading: Reading) {
        _pending = State(initialValue: ArchiveConfirmation(sessions: reading.sessions))
    }

    var body: some View {
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

// The prompt as it is raised, over a stand-in for the surface it covers. The title quoting a long
// name without swallowing it is the other thing to look at here.
#Preview("Archive prompt — an agent Argo will end") {
    ArchivePromptSpecimen(.ending)
        .frame(width: 420, height: 260)
}

// The state #1596 is about: the row leaves the roster and the agent behind it keeps working. Read
// the verb against the one above — "Anyway" is the whole of what stops the button promising an end
// this window cannot perform.
#Preview("Archive prompt — an agent Argo cannot end") {
    ArchivePromptSpecimen(.outliving)
        .frame(width: 420, height: 260)
}

// A batch that is both, which is what a roster carrying a previous run's Sessions produces. The
// counts are what this one is for: they must add up to the title's, and the reader must be able to
// tell from the paragraph alone which half survives.
#Preview("Archive prompt — a mixed batch") {
    ArchivePromptSpecimen(.mixed)
        .frame(width: 420, height: 260)
}
