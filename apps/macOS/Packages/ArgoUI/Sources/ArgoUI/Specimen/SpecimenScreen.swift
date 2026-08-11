import SwiftUI

/// One catalog entry filling the window. No per-case frame: a state is judged at the width the app
/// actually gives it.
public struct SpecimenScreen: View {
    /// Read by the case helpers in `SpecimenScreen+Cases.swift`, which key their fixtures off it.
    let specimen: Specimen

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
        case .ghostedRows:
            // The same rows with access mixed down the list. Whether a row reads as one you
            // cannot drive — with no glyph left saying so, and against neighbours you can —
            // is a comparison, and a comparison needs both halves on one screen.
            GhostedRosterSpecimen()
        case .roster:
            RosterSpecimen()
        case .churningRoster:
            // The same shell with the sort key moving under it. Every other roster case is an
            // order that has stopped; this one is the order the bug lives in — two Sessions
            // trading places on every burst of writes, under a reader who is already on one.
            ChurningRosterSpecimen()
        case .archivedRoster:
            // The other half of the same feature: where a cleared Session went, and how loud
            // the foot that holds it is under a roster it must not compete with.
            ArchivedRosterSpecimen()
        case .spawningRoster:
            // The one case whose point is the CLICK: the shell over a Project with nothing
            // started in it, and a spawn that answers with a row instead of doing nothing.
            // Rendered, it is the empty roster beside a live New Session button; driven, it is
            // the only way to see that pressing it puts a Session on the roster and points there.
            SpawningRosterSpecimen()
        case .renamedRoster:
            // A roster with one name somebody typed on it, beside two the transcripts derived.
            // Whether a chosen name reads as the Session's own rather than as a label pinned over
            // a title is a rendering, and it is only judgeable against rows that were not renamed.
            RenamedRosterSpecimen()
        case .editingRow:
            // A row mid-rename, its neighbours at rest. The field stands where the title was, so
            // what has to be judged is whether the row still reads as one row of a list while it
            // is being typed into — a claim about a box inside a sidebar capsule that no value
            // test can reach.
            EditingRowSpecimen()
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
        case .sessionHeader:
            // The default posture, and the quiet one: a header that names its Session and spends
            // no mark at all. What the PNG settles is that the silence reads as a header rather
            // than as a zone that failed to draw half of itself — and that a real title, long
            // enough to be cut, still reads as the largest line on the plane.
            SessionHeaderSpecimen(access: .managed)
        case .externalSessionHeader:
            // A Session nobody here started, marked. The judgement is whether one small word
            // beside a title is findable without being loud — a fact worth reading once.
            SessionHeaderSpecimen(access: .external)
        case .orphanedSessionHeader:
            // The posture that only exists because the two read differently: "this was yours and
            // Argo lost the terminal" against "this was never yours". Its own case because the
            // two are only judgeable as a PAIR, and a pair is two PNGs.
            SessionHeaderSpecimen(access: .orphaned)
        case .longBranchSessionHeader:
            // A real branch name that the line cannot hold, rendered narrow as well as wide with
            // `ARGO_WINDOW_SIZE` — which is what makes the floor a render somebody else can
            // repeat rather than a window dragged by hand. What it settles is which fact gives
            // way: the branch is cut, and the marks, the model and the issue after it survive.
            SessionHeaderSpecimen(header: SessionHeaderFixture.longBranch)
        case .contextOk, .contextWarn, .contextCrit, .contextUnknown:
            // A whole header per tier, because what is being judged is whether the reading is
            // findable beside a title and a branch — and the fourth is the one that matters most:
            // an unreadable context has to look like an ABSENCE rather than like a fresh window.
            SessionHeaderSpecimen(header: contextHeader)
        case .sessionSpend, .sessionSpendUnreported:
            // The spend line in the deck it lives in, with and without the subagent fact. The two
            // are only judgeable as a PAIR — what has to be true is that the shorter line reads as
            // a complete line rather than as one a number fell out of — and a pair is two PNGs.
            SessionHeaderSpecimen(header: spendHeader)
        case .handoffWithheld, .handoffAtWarn, .handoffAtCrit, .handoffOnReadOnly,
             .handoffOnOrphaned:
            // A whole header per state of the offer, because the claim is about a LINE: that the
            // button is findable beside the reading without competing with the title, that its
            // urgency reads as the reading's, and — in the first and last two — that a header with
            // no button on it is still a complete line rather than one a control fell out of.
            SessionHeaderSpecimen(header: handoffHeader)
        case .handedOffReading:
            // The other half of the remedy, which is a pair of claims about one Session and so one
            // PNG: the header keeps its red reading and has no button left on it, and the reading
            // ends in the link to the Session the work went to. The link is the only row in the
            // feed that leads anywhere, and whether it reads as pressable at the foot of a spent
            // transcript — under a hairline, in machine type — is exactly what no test can say.
            InstrumentDeckShell(
                room: .sessions,
                feed: FeedProjection.previewHandedOffRows,
                header: handoffHeader,
            )
        case .feedPermissionExpired:
            // A refusal nobody made, at the foot of the reading it interrupted (#573). The whole
            // deck rather than the row alone, because the claim is about a CONTRAST: the amber has
            // to read as a departure from the hairlines it sits among without reading as an error
            // the agent hit — and the punctuation it is judged against is only there in the feed.
            InstrumentDeckShell(
                room: .sessions,
                feed: FeedProjection.previewExpiredRows,
            )
        case .contextGuide:
            // The ⓘ panel, stood in a glass of its own — a popover is a window of its own and
            // never lands in a screenshot of this one (`DrawerSpecimen`).
            ContextGuideSpecimen()
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
            // A command open beside a File path, at the panel's floor. The two are cut at OPPOSITE
            // ends, and a header three lines deep has not moved the close control.
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
        case .feedArriving:
            // The same length, still being written. Every other case here is a reading that has
            // stopped, and the claim this one carries is about a reading that has not: a row
            // arriving at the end must not move the row somebody is looking at.
            ArrivingFeedSpecimen()
        case .emptyFeed:
            // A Session that has said nothing. The empty column has to SAY so — a blank zone is
            // indistinguishable from one that failed to draw, and it is the state every change to
            // how the feed holds its place is most likely to break.
            sessions([])
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
        case .floatingControls:
            // Whether glass reads as "a state you are in" rather than as a second record is the
            // whole judgement of D14's clause, and it is not one a test can make.
            FloatingControlsSpecimen()
        case .flatFloatingControls:
            // A shipping gate: the same three have to stay legible, findable and pressable with
            // the optical response taken away.
            FloatingControlsSpecimen(isFlat: true)
        case .feedLeftBehind:
            // The way back, carrying how much was said while the reader was reading. Three, under a
            // stretch of the long feed that holds dozens of calls — which is the judgement: whether
            // a small number on a control standing over that much work reads as "what you missed"
            // rather than as a count of everything that moved.
            sessions(FeedProjection.longRows, held: FeedProjection.longHeldRowID)
        case .feedLeftBehindInSilence:
            // The same control with nothing said since, which is only judgeable beside the case
            // above it. What the pair is a render OF is `FeedProjection.longSilentRows`.
            sessions(FeedProjection.longSilentRows, held: FeedProjection.longHeldRowID)
        case .twoReadings:
            // The whole shell over two Sessions that each have one, because switching between them
            // is only reachable through the real sidebar. What it exists to make drivable is the
            // claim that a pane's state dies with the Session it belonged to — the place the reader
            // stopped at most of all, which `FeedRow.ID` being a POSITION otherwise carries across.
            RosterSpecimen(presentation: .twoReadings)
        case .composer:
            // The composed state, which only the deck can show: the glass vessel against the
            // reading, the fade letting rows run under it, and the newest line standing clear.
            sessions(FeedProjection.previewRows, composer: ComposerSpecimen.composer)
        case .composerTyping:
            // A multi-line draft, because the growth past one line is the state — and whether
            // six lines still leave a vessel rather than a wall is the judgement.
            ComposerSpecimen(draft: ComposerSpecimen.typing)
        case .composerRefusal:
            // A refused send: the message still where it was typed, the reason on the seam
            // above the vessel, and a way to try again.
            ComposerSpecimen(draft: ComposerSpecimen.refused)
        case .flatComposer:
            // The shipping gate every glass surface carries: legible, findable and pressable
            // with the optical response taken away.
            sessions(FeedProjection.previewRows, composer: ComposerSpecimen.composer)
                .argoWithoutTransparency()
        case .composerStanding:
            // The tray at rest, which is where a standing allow has to be findable: the turn AFTER
            // the grant, with the prompt that made it long gone (#572).
            sessions(FeedProjection.previewRows, composer: ComposerSpecimen.standing)
        case .permission:
            // A gated command holding the composer's slot: the tool and its target verbatim, the
            // amber rim, Allow focused — the state the whole channel exists to raise.
            sessions(FeedProjection.previewRows, prompt: PermissionSpecimen.command)
        case .permissionStanding:
            // The same prompt on a Session that already holds two grants: the standing offer on the
            // footer's trailing edge, and above it the record of what it makes.
            sessions(FeedProjection.previewRows, prompt: PermissionSpecimen.standing)
        case .permissionEdit:
            // The other tool kind the prompt renders: a path and the hunk it would write, with
            // the counts said under the block rather than inside it.
            sessions(FeedProjection.previewRows, prompt: PermissionSpecimen.edit)
        case .flatPermission:
            // The same shipping gate the composer's glass carries.
            sessions(FeedProjection.previewRows, prompt: PermissionSpecimen.command)
                .argoWithoutTransparency()
        }
    }
}
