import SwiftUI

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
        case .feedNarration:
            // The rows the agent narrated, with the ones it did not taken out. Whether a sentence
            // in the subject slot still reads as a ROW — label, then name-of-the-thing — rather
            // than as a paragraph under a verb is the judgement, and it is only answerable with a
            // run of them one under another. The tense clash is deliberate and on screen: `Ran`
            // above `List open issues` is Argo's voice above the agent's, kept rather than fixed.
            sessions(FeedProjection.previewNarratedRows)
        case .feedCommands:
            // The other host: eight commands with nothing narrating them, which is every Codex
            // Session and Claude Code's fallback. The judgement is whether eight rows that all
            // began life on the same scratchpad path now differ from each other in their first
            // words — and whether an ellipsis reads as a cut rather than as part of the command.
            // Rendered narrow as well as wide: a row's whole promise is that it stays one line.
            sessions(FeedProjection.previewCommandRows)
        case .feedCommandFold:
            // A turn that looked around through a shell, then changed something. The count at the
            // top stands for seven calls, five of them commands; the edit under it is what the
            // looking was for; and the commit and the push below that are still two rows. What is
            // being judged is the BOUNDARY — that the folded line reads as a stretch of looking
            // and not as a summary of the turn, and that nothing loud got counted into it.
            sessions(FeedProjection.previewFoldRows)
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
        case .evidenceAddresses:
            // The per-subject split, which is the whole judgement: a command open beside a File
            // path, at the panel's own floor. What is being looked at is that the two are cut at
            // OPPOSITE ends — the command from its beginning down three lines, the path from its
            // front on one — and that a header three lines deep has not moved the close control.
            EvidenceSpecimen()
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
        case .feedAtScale:
            // A session at the length a real one reaches, so the claims that only fail at scale
            // have something to fail against: whether the rhythm survives fifty turns of it, and
            // whether a fold still reads as a fold at the bottom of a long scroll.
            // Rendered narrow as well as wide — `ARGO_WINDOW_SIZE` is what makes the floor a
            // render somebody else can repeat rather than a window dragged by hand.
            sessions(FeedProjection.longRows)
        case .feedAtScaleEvidence:
            // The same length with a call's evidence open, which is the state the narrowest deck
            // is actually met in: two columns sharing 680 points, and the question is whether the
            // reading is still a reading at the width the panel leaves it.
            sessions(FeedProjection.longRows, open: FeedProjection.longFailedCallID)
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
            // The deck opens holding the shot rather than a second lightbox being laid over it:
            // the lightbox now takes focus so Escape reaches it, and an overlay outside the deck
            // would be a copy of the surface with none of that wiring.
            sessions(FeedProjection.previewCallRows, lit: FeedProjection.previewShots.first)
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
    private func sessions(
        _ feed: [FeedRow],
        open: FeedRow.ID? = nil,
        lit: FeedShot? = nil,
    )
        -> some View {
        InstrumentDeckShell(room: .sessions, feed: feed, open: open, lit: lit)
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

#Preview("Specimen — a Codex feed, where nothing narrates a command") {
    SpecimenScreen(specimen: .feedCommands)
        .frame(width: 1000, height: 620)
}

// The same commands at the narrowest deck a 960-point window produces. The width is part of the
// state: a shortened command's whole promise is that its row stays one line where there is least
// room for it.
#Preview("Specimen — a Codex feed at the narrowest deck") {
    SpecimenScreen(specimen: .feedCommands)
        .frame(
            width: ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth,
            height: ArgoLayout.windowMinimumHeight,
        )
}

#Preview("Specimen — a session at the length a real one reaches") {
    SpecimenScreen(specimen: .feedAtScale)
        .frame(width: 1000, height: 620)
}

// The narrowest deck a 960-point window can produce, with both columns in it. The width is part of
// the state: this is the one place the reading and the panel have to share 680 points.
#Preview("Specimen — a long feed at the narrowest deck, panel open") {
    SpecimenScreen(specimen: .feedAtScaleEvidence)
        .frame(
            width: ArgoLayout.windowMinimumWidth - ArgoLayout.sidebarMinimumWidth,
            height: ArgoLayout.windowMinimumHeight,
        )
}
