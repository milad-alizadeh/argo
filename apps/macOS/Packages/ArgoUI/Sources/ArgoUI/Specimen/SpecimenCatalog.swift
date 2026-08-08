import SwiftUI

/// The named states the render harness can put on screen, one per launch.
///
/// `#Preview` is the story (`swift-style.md`), but Xcode is the only thing that can draw one, and a
/// screenshot is the only evidence a visual claim can be checked against. This catalog addresses
/// the same states by a name the command line can pass, so a state can be rendered to a PNG without
/// a human driving the app into it — which for most of them is not possible at all, since the app
/// launched against an ordinary checkout shows no Sessions.
///
/// Add a case here and it is renderable; `scripts/specimens.sh` reads the list out of this file
/// rather than repeating it.
public enum Specimen: String, CaseIterable, Sendable {
    case foundations
    case contract
    case sessionRows
    case roster
    case toolbarScope
    case emptyToolbarScope
    case projectDrawer
    case unreachableProjectDrawer
    case emptyProjectDrawer
    case openProjectDrawer
    case deck
    case sessionsDeck
    case feed
    case feedCalls
    case feedProse
    case feedMarkdown
    case feedEvidence
    case feedRunEvidence
    case feedSurveyEvidence
    case feedDocumentEvidence
    case feedAttention
    case feedPunctuation
    case feedAgents
    case feedGallery
    case feedSingleShot
    case feedAbsentShot
    case feedLightbox
    case planPill
    case openPlanPill
    case unstartedPlanPill
}

/// One catalog entry filling the window. No per-case frame: a state is judged at the width the app
/// actually gives it.
public struct SpecimenScreen: View {
    private let specimen: Specimen

    public init(specimen: Specimen) {
        self.specimen = specimen
    }

    public var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .argoAppearance()
    }

    @ViewBuilder private var content: some View {
        switch specimen {
        case .foundations:
            FoundationSpecimen()
        case .contract:
            ContractSpecimen()
        case .sessionRows:
            SessionRowsSpecimen()
        case .roster:
            RosterSpecimen()
        case .toolbarScope:
            ToolbarSpecimen(presentation: .preview)
        case .emptyToolbarScope:
            ToolbarSpecimen(presentation: .unregisteredPreview)
        case .projectDrawer:
            DrawerSpecimen(presentation: .preview)
        case .unreachableProjectDrawer:
            DrawerSpecimen(presentation: .unreachablePreview)
        case .emptyProjectDrawer:
            // A machine that has registered nothing: Add Project… is the only thing on screen,
            // and it has to be findable without a row beside it to point at.
            DrawerSpecimen(presentation: .unregisteredPreview)
        case .openProjectDrawer:
            OpenDrawerSpecimen()
        case .deck:
            DeckSpecimen()
        case .sessionsDeck:
            // The shell, not `SessionsDeck` — the assembled container is the plane plus its
            // zones, and "one opaque plane" is a claim about the plane.
            InstrumentDeckShell(room: .sessions)
        case .feed:
            // The deck at rest with a Session read into it, drawn through the same projection the
            // shell uses. A specimen holding rows of its own would be evidence about a feed
            // nobody is shown.
            // The plan comes with it: the transcript carries one, and a render of the deck at rest
            // that dropped the pill would be evidence about a deck nobody is shown.
            InstrumentDeckShell(
                room: .sessions,
                feed: FeedProjection.previewRows,
                showing: PlanShowing(plan: PlanProjection.previewReading),
            )
        case .feedCalls:
            // The work itself, between the prose taken out: every kind the feed can name, the two
            // same-named files that make a qualifier appear, and the failure that earns a second
            // line. Its own case because in the full feed they are four rows in a screenful.
            sessions(FeedProjection.previewCallRows)
        case .feedProse:
            // What the agent SAID, with the work taken out: the heading, the list and the fenced
            // block of a real answer. The markdown is drawn as blocks, and whether an outline reads
            // as an outline is the judgement no test can make.
            sessions(FeedProjection.previewProseRows)
        case .feedMarkdown:
            // Every block one message can be made of, at the feed's own measure and nothing else
            // on the screen. Four of them are judgements no test can make: whether a fence reads
            // as code under the grammar the agent named, whether a table's columns take the width
            // their words need, whether a `code` span is findable mid-sentence, and whether a link
            // reads as pressable before anybody presses it.
            MarkdownSpecimen()
        case .feedEvidence:
            // The panel open on the failed command. The one state a screenshot has to carry: the
            // feed narrowed to its measure, the rail spent, and what went wrong readable in full
            // beside the row that says only that it did.
            // The call rows rather than the whole feed: opening a row narrows the column it is in,
            // and against the full transcript the failure this is a render OF sits below the fold.
            // A screenshot of a panel whose row is off screen shows half the state.
            sessions(FeedProjection.previewCallRows, open: FeedProjection.previewFailedCallID)
        case .feedRunEvidence:
            // The collapsed run, open. One row said `Edited FeedCallLine.swift ×3`, and the whole
            // claim of the collapse is that the three moments are still three in the panel — which
            // is a thing to look at rather than to assert.
            sessions(FeedProjection.previewCallRows, open: FeedProjection.previewRunCallID)
        case .feedSurveyEvidence:
            // The folded run of looking, open. The line says `Searched 1 · Read 5` and nothing
            // else; the claim of the fold is that the five files it stopped naming are still all
            // there, each caption saying which of them the output under it came from.
            sessions(FeedProjection.previewCallRows, open: FeedProjection.previewSurveyRowID)
        case .feedDocumentEvidence:
            // A markdown file the agent wrote, open. It opens as the DOCUMENT and not as the
            // patch — whether an outline reads as an outline once the `##` stops being drawn is
            // the whole judgement, and it is not one a test can make.
            sessions(FeedProjection.previewCallRows, open: FeedProjection.previewDocumentCallID)
        case .feedAttention:
            // Both questions at once: the one still waiting, in the only attention ink the feed
            // has, and the one already settled with the option that was taken marked on it. The
            // judgement is that the second has stopped asking for attention — which is a thing to
            // look at, since a colour nobody compares reads as loud whatever it is.
            sessions(FeedProjection.previewAskRows)
        case .feedPunctuation:
            // The marks, alone. Whether a hairline across the column reads as the reading changing
            // shape — rather than as a rule drawn under the row above it — is the whole question,
            // and it is only answerable with the three of them on one screen.
            sessions(FeedProjection.previewMarkRows)
        case .feedAgents:
            // The rail, filled. Two subagents still working and one landed with what it spent, at
            // the width the deck actually gives it: whether a labelled figure fits beside a brief
            // without either being cut is a measurement, not an assertion.
            AgentsRail(agents: FeedAgents.all(in: FeedProjection.previewRows))
                .frame(width: ArgoLayout.agentsRailWidth)
                .argoDeckSurface()
        case .feedGallery:
            // The run of pictures, in the feed it folds inside. Four provenances in one row, and
            // the judgement is whether they read as four different claims without the captions
            // being read — a capture, a re-read of the path, an artifact the plugin drew, and the
            // shot the record kept nothing for.
            InstrumentDeckShell(
                room: .sessions,
                feed: FeedProjection.previewCallRows,
            )
        case .feedSingleShot:
            // One shot, alone. The claim is that it gets the SAME treatment as a set — a gallery
            // of one that shrank back to a filename row would be the fold apologising for itself.
            sessions(FeedProjection.previewSingleShotRows)
        case .feedAbsentShot:
            // The picture the record never kept. It has to read as a marked absence rather than as
            // an image that failed to load, and it must not look pressable — which is a thing to
            // look at, since nothing about a disabled button asserts how it reads.
            sessions(FeedProjection.previewAbsentShotRows)
        case .feedLightbox:
            // A shot opened full size over the whole deck. Only reachable by clicking a thumbnail,
            // so without this case the surface is never looked at — and what it has to settle is
            // whether the picture reads as laid OVER a deck rather than as a second screen.
            sessions(FeedProjection.previewCallRows)
                .argoLightbox(.constant(FeedProjection.previewShots.first))
        case .planPill:
            // Whether one line above the dock reads as standing state rather than as the newest
            // thing the agent said.
            PlanSpecimen(plan: PlanFixture.working)
        case .openPlanPill:
            // Reachable only by hovering or tabbing, so without this case the half of the surface
            // that carries the plan is never looked at.
            PlanSpecimen(plan: PlanFixture.working, isRevealed: true)
        case .unstartedPlanPill:
            // Whether an absence reads as a plan nobody started rather than as a pill that failed
            // to fill in its own line.
            PlanSpecimen(plan: PlanFixture.unstarted, isRevealed: true)
        }
    }

    /// The Sessions room with a reading in it — the shell and not `SessionsDeck`, because what is
    /// being judged is the assembled container. Spelled once: most of this catalog is that one
    /// state with a different feed in it, and repeating the call per case made each of them four
    /// lines of plumbing around the one word that differs.
    private func sessions(_ feed: [FeedRow], open: FeedRow.ID? = nil) -> some View {
        InstrumentDeckShell(room: .sessions, feed: feed, open: open)
    }
}

#Preview("Specimen — the deck") {
    SpecimenScreen(specimen: .deck)
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — the Sessions deck container") {
    SpecimenScreen(specimen: .sessionsDeck)
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — the feed at rest") {
    SpecimenScreen(specimen: .feed)
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — the work, as sentence-shaped lines") {
    SpecimenScreen(specimen: .feedCalls)
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — a run of pictures in the feed") {
    SpecimenScreen(specimen: .feedGallery)
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — a shot opened full size") {
    SpecimenScreen(specimen: .feedLightbox)
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — the plan above the dock") {
    SpecimenScreen(specimen: .planPill)
        .frame(width: 1000, height: 620)
}

#Preview("Specimen — the plan's whole list") {
    SpecimenScreen(specimen: .openPlanPill)
        .frame(width: 1000, height: 620)
}
