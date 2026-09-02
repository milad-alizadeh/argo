import ArgoFixtures
import ArgoUI

extension PlanProjection {
    /// The preview transcript's plan — the one place every specimen and `#Preview` takes the pill's
    /// reading from, so none of them can be looking at a different list.
    static let previewReading = reading(from: TranscriptFixtures.previewTranscript)
}
