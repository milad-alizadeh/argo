import ArgoEngine
import ArgoUI
import Foundation

extension CockpitPresentation {
    /// Measured back from whenever the preview is read: a fixed stamp would age into `3y ago`
    /// on every row. Shared with the specimens, which need the same moving `now`.
    static func minutesAgo(_ minutes: Int) -> Int {
        Date().epochMs - minutes * 60 * 1000
    }
}
