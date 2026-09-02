import ArgoAtoms
import ArgoDesign
import SwiftUI

/// The Session's title where it now lives — centred in the window's chrome, at the width of the
/// detail pane it is centred on.
///
/// The bar and not the whole shell, because what these PNGs settle is a measurement: whether the
/// title reads as the window's document title, whether it cuts at the tail rather than reaching the
/// vessels pinned to either edge, and whether a read-only posture states itself beside the name.
/// The hover the rest of the facts moved to is a native tooltip, which no screenshot can capture —
/// `SessionHeaderTooltipTests` is what holds that.
struct TitlebarTitleSpecimen: View {
    /// The detail pane at the window's DEFAULT size — where a real title mostly fits.
    static let widePane: CGFloat = ArgoLayout.windowIdealWidth - ArgoLayout.sidebarIdealWidth
    /// The narrowest detail pane the window allows, which is where the share does its work.
    static let narrowPane: CGFloat = ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth

    let header: SessionHeaderProjection.Header?
    /// The detail pane this title is centred on, and the width its share is taken of.
    var paneWidth: CGFloat = widePane

    var body: some View {
        TitlebarTitle(header: header, paneWidth: paneWidth)
            .frame(width: paneWidth, height: ArgoToolbarVessel.height)
            .argoChromeBar()
            .argoAppearance()
    }

    /// Every posture one under another, with nothing selected below them — for the previews that
    /// judge the set as a group. An empty bar and a bar with no Session on it are two absences.
    static func gallery(width: CGFloat) -> some View {
        VStack(alignment: .center, spacing: ArgoSpacing.snug) {
            ForEach(Array(SessionHeaderFixture.headers.enumerated()), id: \.offset) { _, header in
                TitlebarTitleSpecimen(header: header, paneWidth: width)
            }
            TitlebarTitleSpecimen(header: nil, paneWidth: width)
        }
        .argoAppearance()
    }
}

#Preview("Titlebar title specimen — a managed Session") {
    TitlebarTitleSpecimen(header: SessionHeaderFixture.header(for: .managed))
}

#Preview("Titlebar title specimen — a Session nobody here started") {
    TitlebarTitleSpecimen(header: SessionHeaderFixture.header(for: .external))
}
