import ArgoDesign
import ArgoUI
import SwiftUI

#Preview("Titlebar title — every access posture, and nothing selected") {
    TitlebarTitleSpecimen.gallery(width: 900)
}

#Preview("Titlebar title — at the narrowest detail pane the window allows") {
    TitlebarTitleSpecimen.gallery(
        width: ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth,
    )
}
