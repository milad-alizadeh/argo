import ArgoDesign
import ArgoEngine
import ArgoUI
import SwiftUI

#Preview("Attachment chip — a picture, a source file and a log") {
    VStack(alignment: .leading, spacing: ArgoSpacing.tight) {
        ForEach(AttachmentFixture.mixed) { attachment in
            AttachmentChip(attachment: attachment, remove: {})
        }
    }
    .padding(ArgoSpacing.section)
    .argoDeckSurface()
    .argoAppearance()
}
