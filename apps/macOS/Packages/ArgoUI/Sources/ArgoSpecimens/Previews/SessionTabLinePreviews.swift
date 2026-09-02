import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("Tab line — every access posture, and nothing selected") {
    SessionTabLineGallery(width: 900)
}

#Preview("Tab line — at the narrowest deck the window allows") {
    SessionTabLineGallery(width: ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth)
}
