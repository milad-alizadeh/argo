import ArgoDesign
import AtlasLayout
import SwiftUI

/// What somebody WROTE about this file, beside what was measured of it (#1159, the approved
/// design's `#read .said`).
///
/// **Drawn differently from every measured line, on purpose.** The design's own rule: a reader has
/// to be able to tell at a glance which lines are counted and which are read, so the sentence sits
/// on a ground of its own with an edge around it, set as prose, while every number in the panel
/// around it is set bare. Nothing here is banded, ranked or placed against a range — a Note is not
/// a Measure and the panel must never make it look like one.
///
/// It takes a Note rather than reading one out of `AtlasFileReading`, which is the whole shape of
/// the written layer: the measured reading knows nothing about it, so a repository with no written
/// layer draws exactly the same map and exactly the same numbers.
struct AtlasReadingNote: View {
    @Environment(\.argo) private var argo

    let note: AtlasNote

    var body: some View {
        VStack(alignment: .leading, spacing: ArgoSpacing.flush) {
            words
            if !note.why.isEmpty {
                flag
            }
            if note.standing == .stale {
                staleness
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(ArgoSpacing.comfortable)
        .background(
            argo.color.interaction.accent(at: .wash),
            in: .rect(cornerRadius: ArgoRadius.control),
        )
        .overlay {
            RoundedRectangle(cornerRadius: ArgoRadius.control)
                .strokeBorder(argo.color.edge.subtle, lineWidth: ArgoStroke.border)
        }
        .accessibilityElement(children: .combine)
        // Said in the label, because the ground and the edge are what say it on screen and neither
        // reaches a reader who is listening: this is a sentence somebody wrote, not a measurement.
        .accessibilityLabel("Written note. \(note.words)")
    }

    /// The sentence itself, set as prose.
    ///
    /// At the body rung rather than the design's callout: every interface role at that rung in the
    /// contract carries a control's weight, and this is a paragraph. It is the rung the panel's
    /// other sentence — the idle reading beside it — is already set at, so the two agree.
    private var words: some View {
        Text(note.words)
            .argoText(ArgoTypography.body)
            .foregroundStyle(argo.color.text.primary)
            .lineSpacing(AtlasNoteMeasure.proseLeading)
            .fixedSize(horizontal: false, vertical: true)
    }

    /// The question the measurements asked that got this written, in the same quiet machine face
    /// every provenance line in the panel takes. It is kept beside the answer because a sentence
    /// about somebody's code with no question in front of it reads as an unprompted opinion.
    private var flag: some View {
        Text(note.why.joined(separator: " "))
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(argo.color.interaction.accentBright)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, ArgoSpacing.base)
    }

    /// A Note whose subject has changed since it was written STAYS, and says so.
    ///
    /// The mark is typographic rather than a status colour: the gauge under this draws the measure
    /// ramp's own amber and red, and a state role here would put two unrelated readings of the
    /// same colour in one field of view — which is the exemption #1142 took the ramp under, read
    /// the other way round.
    private var staleness: some View {
        Text(AtlasNoteMeasure.stale)
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(argo.color.text.secondary)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, ArgoSpacing.base)
    }
}

/// The note block's own words and measures. Here rather than in the contract for
/// `AtlasGaugeMeasure`'s reason: they describe this one block and nothing else in the app.
enum AtlasNoteMeasure {
    /// How a stale Note says so. One sentence, about the FILE rather than about the note: what
    /// changed is the subject, and a reader deciding whether to trust the sentence needs to know
    /// which of the two moved.
    static let stale = "The file has changed since this was written."

    /// The extra leading a paragraph takes over the contract's one-line box. The contract's ratio
    /// is a line box rather than paragraph leading and carries no prose measure, which the design
    /// says out loud where it sets `--line-prose`.
    static let proseLeading = ArgoSpacing.tight
}
