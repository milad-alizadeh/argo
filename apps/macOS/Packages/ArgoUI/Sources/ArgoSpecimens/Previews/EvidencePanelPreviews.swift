import ArgoEngine
import ArgoUI
import SwiftUI

#Preview("Evidence — a failed command's whole output") {
    EvidenceFixture.failed.map { EvidencePanel(evidence: $0, dismiss: {}) }
        .frame(width: 420, height: 480)
        .argoAppearance()
}

#Preview("Evidence — the patch one edit made") {
    EvidenceFixture.edited.map { EvidencePanel(evidence: $0, dismiss: {}) }
        .frame(width: 420, height: 480)
        .argoAppearance()
}

#Preview("Evidence — everything a folded run of looking read") {
    EvidenceFixture.surveyed.map { EvidencePanel(evidence: $0, dismiss: {}) }
        .frame(width: 420, height: 480)
        .argoAppearance()
}

#Preview("Evidence — a folded run, scrolled to the file the feed pointed at") {
    EvidenceFixture.surveyed.map { EvidencePanel(evidence: $0, current: 2, dismiss: {}) }
        .frame(width: 420, height: 480)
        .argoAppearance()
}
