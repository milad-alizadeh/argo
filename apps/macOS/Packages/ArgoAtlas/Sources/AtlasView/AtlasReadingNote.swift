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
            if !note.flag.isEmpty {
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
    /// At the body rung rather than the design's callout, which is a deviation with a measurement
    /// behind it: every interface role at the callout rung carries a control's weight, and this is
    /// a paragraph. Measured against the approved render, the two set the same: 36px of line pitch
    /// at 2x, because the design's 12px at its prose leading and this rung's own line box come to
    /// one number. It is also the rung the panel's other sentence — the idle reading — is set at.
    private var words: some View {
        Text(note.words)
            .argoText(ArgoTypography.body)
            .foregroundStyle(argo.color.text.primary)
            .fixedSize(horizontal: false, vertical: true)
    }

    /// The question the measurements asked that got this written, in the same quiet machine face
    /// every provenance line in the panel takes. It is kept beside the answer because a sentence
    /// about somebody's code with no question in front of it reads as an unprompted opinion.
    private var flag: some View {
        Text(note.flag.joined(separator: " "))
            .argoText(ArgoTypography.machineCaption)
            .foregroundStyle(argo.color.interaction.accentBright)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, ArgoSpacing.base)
    }

    /// A Note whose subject has changed since it was written STAYS, and says so.
    ///
    /// Appearance the approved design does not carry: it has no stale state, so this is new and is
    /// drawn in the design's own vocabulary rather than invented beside it.
    ///
    /// The mark is typographic rather than a status colour, because the gauge under this draws the
    /// measure ramp's own amber and red and a state role here would put two unrelated readings of
    /// one colour in a single field of view. It is a marking rather than a third paragraph of the
    /// note, so it takes the interface face at a control's weight and the loudest ink in the block:
    /// a mark nobody notices is a note passing itself off as current.
    private var staleness: some View {
        Text(Self.stale)
            .argoText(ArgoTypography.control)
            .foregroundStyle(argo.color.text.primary)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, ArgoSpacing.base)
    }

    /// How a stale Note says so. One sentence, about the FILE rather than about the note: what
    /// changed is the subject, and a reader deciding whether to trust the sentence has to be told
    /// which of the two moved.
    private static let stale = "The file has changed since this was written."
}
