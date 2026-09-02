import ArgoDesign
import ArgoEngine
import ArgoUI
import SwiftUI

#Preview("Attachment tray — a picture and two files") {
    AttachmentTray(attachments: AttachmentFixture.mixed, remove: { _ in })
        .padding(ArgoSpacing.section)
        .frame(width: 640)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Attachment tray — one pasted image") {
    AttachmentTray(attachments: [AttachmentFixture.pasted], remove: { _ in })
        .padding(ArgoSpacing.section)
        .frame(width: 640)
        .argoDeckSurface()
        .argoAppearance()
}

#Preview("Attachment tray — a narrow vessel and a long name") {
    AttachmentTray(attachments: AttachmentFixture.longNames, remove: { _ in })
        .padding(ArgoSpacing.section)
        .frame(width: 320)
        .argoDeckSurface()
        .argoAppearance()
}
