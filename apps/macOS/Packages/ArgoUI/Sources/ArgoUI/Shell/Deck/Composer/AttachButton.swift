import ArgoEngine
import SwiftUI
import UniformTypeIdentifiers

/// The leading `+` — the third way to give a Session a file, beside a drop and a paste (#540).
///
/// A `+` and not a paperclip: what it opens is "give the agent something", which is the same act
/// all three gestures make, and a paperclip would name only the one that goes through a picker.
///
/// **It is absent, never disabled, for an adapter that takes no attachments** (design decision 9).
/// That absence is the caller's — this view exists only where the capability holds, because a
/// control that renders itself away is one whose disabled state somebody will eventually add back.
struct AttachButton: View {
    @Environment(\.argo) private var argo

    let attach: ([SessionAttachment]) -> Void

    @State private var isPicking = false

    var body: some View {
        Button { isPicking = true } label: {
            ArgoGlyph(ArgoSymbol.attach, .control)
                .foregroundStyle(argo.color.text.secondary)
                .frame(
                    width: ArgoComposerVessel.controlDiameter,
                    height: ArgoComposerVessel.controlDiameter,
                )
                .contentShape(.circle)
        }
        .buttonStyle(.plain)
        .help(AttachmentProjection.attach)
        .accessibilityLabel(AttachmentProjection.attach)
        // Every type, because the agent reads a path and Argo has no business deciding which files
        // a person may point it at. What the chip draws differs by kind; what may be attached does
        // not.
        .fileImporter(
            isPresented: $isPicking,
            allowedContentTypes: [.item],
            allowsMultipleSelection: true,
        ) { result in
            guard case let .success(urls) = result else { return }
            attach(urls.map(SessionAttachment.file(at:)))
        }
    }
}

#Preview("Attach button") {
    AttachButton(attach: { _ in })
        .padding(ArgoSpacing.section)
        .argoDeckSurface()
        .argoAppearance()
}
