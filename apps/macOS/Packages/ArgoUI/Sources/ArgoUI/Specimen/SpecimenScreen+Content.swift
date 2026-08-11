import SwiftUI

// The catalog itself: one arm per renderable state.
//
// Outside the struct body so the switch stays EXHAUSTIVE — a new `Specimen` case fails this build.

extension SpecimenScreen {
    @ViewBuilder var content: some View {
        switch specimen {
        case .foundations:
            FoundationSpecimen()
        case .contract:
            ContractSpecimen()
        case .sessionRows:
            SessionRowsSpecimen()
        case .ghostedRows:
            GhostedRosterSpecimen()
        case .roster:
            RosterSpecimen()
        case .churningRoster:
            ChurningRosterSpecimen()
        case .archivedRoster:
            ArchivedRosterSpecimen()
        case .openArchivedRoster:
            // Reachable only by clicking the foot.
            ArchivedRosterSpecimen(isRevealed: true)
        case .spawningRoster:
            // The one case whose point is the CLICK: driven, so New Session must land a row.
            SpawningRosterSpecimen()
        case .renamedRoster:
            RenamedRosterSpecimen()
        case .editingRow:
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
            DrawerSpecimen(presentation: .unregisteredPreview)
        case .openProjectDrawer:
            OpenDrawerSpecimen()
        case .deck:
            DeckSpecimen()
        case .sessionsDeck:
            // The shell, not `SessionsDeck` — the assembled container is the plane plus its zones.
            InstrumentDeckShell(room: .sessions)
        case .sessionHeader:
            SessionHeaderSpecimen(access: .managed)
        case .externalSessionHeader:
            SessionHeaderSpecimen(access: .external)
        case .orphanedSessionHeader:
            SessionHeaderSpecimen(access: .orphaned)
        case .longBranchSessionHeader:
            // Render narrow too (`ARGO_WINDOW_SIZE`): the branch cuts, the marks/model/issue
            // survive.
            SessionHeaderSpecimen(header: SessionHeaderFixture.longBranch)
        case .contextOk, .contextWarn, .contextCrit, .contextUnknown:
            SessionHeaderSpecimen(header: contextHeader)
        case .sessionSpend, .sessionSpendUnreported:
            SessionHeaderSpecimen(header: spendHeader)
        case .handoffWithheld, .handoffAtWarn, .handoffAtCrit, .handoffOnReadOnly,
             .handoffOnOrphaned:
            SessionHeaderSpecimen(header: handoffHeader)
        case .handedOffReading:
            // No button left on the red header, and the reading ends in a link to the next Session.
            InstrumentDeckShell(
                room: .sessions,
                feed: FeedProjection.previewHandedOffRows,
                header: handoffHeader,
            )
        case .feedPermissionExpired:
            // The same marks as `feedPunctuation`, with the refusal nobody made among them (#573).
            sessions(FeedProjection.previewExpiredMarkRows)
        case .contextGuide:
            // A popover is its own window and never lands in a screenshot of this one.
            ContextGuideSpecimen()
        case .feed:
            InstrumentDeckShell(
                room: .sessions,
                feed: FeedProjection.previewRows,
                showing: PlanShowing(plan: PlanProjection.previewReading),
            )
        case .feedCalls:
            sessions(FeedProjection.previewCallRows)
        case .feedNarration:
            // The tense clash is deliberate: `Ran` above `List open issues` is Argo's voice above
            // the agent's, kept rather than fixed.
            sessions(FeedProjection.previewNarratedRows)
        case .feedCommands:
            // Render narrow as well as wide — a row's whole promise is that it stays one line.
            sessions(FeedProjection.previewCommandRows)
        case .feedCommandFold:
            sessions(FeedProjection.previewFoldRows)
        case .feedProse:
            sessions(FeedProjection.previewProseRows)
        case .feedMarkdown:
            MarkdownSpecimen()
        case .feedEvidence:
            // Call rows, not the whole feed: against the full transcript this failure is below the
            // fold.
            sessions(FeedProjection.previewCallRows, open: FeedProjection.previewFailedCallID)
        case .feedRunEvidence:
            sessions(FeedProjection.previewCallRows, open: FeedProjection.previewRunCallID)
        case .feedSurveyEvidence, .feedSurveyEvidenceStep:
            // One pane twice: at the top, and after a click on the THIRD name under the row —
            // `SpecimenScreen+Cases` decides the argument.
            survey(at: surveyStep)
        case .feedDocumentEvidence:
            // A markdown file the agent wrote: it opens as the DOCUMENT and not as the patch.
            sessions(FeedProjection.previewCallRows, open: FeedProjection.previewDocumentCallID)
        case .evidenceAddresses:
            // At the panel's floor: command and path cut at OPPOSITE ends, and a three-line header
            // has not moved the close control.
            EvidenceSpecimen()
        case .feedAttention:
            sessions(FeedProjection.previewAskRows)
        case .feedPunctuation:
            sessions(FeedProjection.previewMarkRows)
        case .feedAgents:
            AgentsRail(agents: FeedAgents.all(in: FeedProjection.previewRows))
                .frame(width: ArgoLayout.agentsRailWidth)
                .argoDeckSurface()
        case .feedAtScale:
            // A session at the length a real one reaches. Render narrow too (`ARGO_WINDOW_SIZE`).
            sessions(FeedProjection.longRows)
        case .feedAtScaleEvidence:
            // The narrowest deck met in practice: two columns sharing 680 points.
            sessions(FeedProjection.longRows, open: FeedProjection.longFailedCallID)
        case .feedArriving:
            // A row arriving at the end must not move the row somebody is looking at.
            ArrivingFeedSpecimen()
        case .feedWorking:
            // A Turn in progress, at the foot of the work it has done so far. The judgement is
            // whether it reads as the reading CONTINUING while sitting between the last thing the
            // agent did and the spend below it — in the same tertiary ink as every other mark, so
            // the ellipsis is doing the whole of the work.
            sessions(FeedProjection.previewWorkingRows)
        case .emptyFeed:
            sessions([])
        case .startingSpawn:
            // The verb while it is being carried out — the first spawn of a window waits on a
            // login shell reporting a `PATH`, and until this state existed that wait looked
            // exactly like a press that did nothing.
            centred { startingSpawn }
        case .feedGallery:
            InstrumentDeckShell(
                room: .sessions,
                feed: FeedProjection.previewCallRows,
            )
        case .feedSingleShot:
            sessions(FeedProjection.previewSingleShotRows)
        case .feedAbsentShot:
            sessions(FeedProjection.previewAbsentShotRows)
        case .feedLightbox:
            // Reachable only by clicking a thumbnail; the lightbox takes focus so Escape reaches
            // it.
            sessions(FeedProjection.previewCallRows, lit: FeedProjection.previewShots.first)
        case .planPill:
            PlanSpecimen(plan: PlanFixture.working)
        case .openPlanPill:
            // Reachable only by hovering or tabbing.
            PlanSpecimen(plan: PlanFixture.working, isRevealed: true)
        case .unstartedPlanPill:
            PlanSpecimen(plan: PlanFixture.unstarted, isRevealed: true)
        case .floatingControls:
            FloatingControlsSpecimen()
        case .flatFloatingControls:
            // A shipping gate: the three stay legible and pressable with the optical response gone.
            FloatingControlsSpecimen(isFlat: true)
        case .feedLeftBehind:
            sessions(FeedProjection.longRows, held: FeedProjection.longHeldRowID)
        case .feedLeftBehindInSilence:
            sessions(FeedProjection.longSilentRows, held: FeedProjection.longHeldRowID)
        case .twoReadings:
            // A pane's state must die with its Session, which `FeedRow.ID` being a POSITION
            // otherwise carries across.
            RosterSpecimen(presentation: .twoReadings)
        // Every state of the composer and of the prompt that takes its slot, drawn in
        // `SpecimenScreen+Vessel.swift`.
        case .composer, .composerTyping, .composerCeiling, .composerDraftKept, .composerQueued,
             .composerRunning, .composerStopped,
             .composerRefusal, .flatComposer, .composerStanding, .composerAttached,
             .composerPasted, .composerDragOver, .composerNoAttach, .permission,
             .permissionStanding, .permissionEdit, .flatPermission:
            vessel
        // Every state of the Connect flow, drawn in `SpecimenScreen+Connect.swift`.
        case .welcome, .connectFresh, .connectFolderOnly, .connectPartly, .connectWired,
             .connectWaiting, .connectRefused, .connectBroken, .projectSettings,
             .connectionStale, .connectionsStale, .connectionNeedsReconnect:
            connectFlow
        }
    }
}
