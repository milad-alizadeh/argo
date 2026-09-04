import ArgoAtoms
import ArgoUI
import SwiftUI

/// The states of the thing the user speaks THROUGH: the composer, what rides above its field, and
/// the Permission prompt that takes its slot.
extension SpecimenRegistry {
    static let vessel: [SpecimenEntry] = composed + drafts + modes + absences + prompts

    private static let composed: [SpecimenEntry] = [
        // The composed state, which only the deck can show: the glass vessel against the reading,
        // the fade letting rows run under it, and the newest line standing clear.
        SpecimenEntry("composer") {
            SpecimenScene.sessions(
                FeedProjection.previewRows,
                vessel: .composer(ComposerSpecimen.composer),
            )
        },
        // The shipping gate every glass surface carries: legible, findable and pressable with the
        // optical response taken away.
        SpecimenEntry("flatComposer") {
            SpecimenScene.sessions(
                FeedProjection.previewRows,
                vessel: .composer(ComposerSpecimen.composer),
            )
            .argoWithoutTransparency()
        },
        // The Turn in flight, composed against a live reading (#541): the send arrow become Stop in
        // the same circle and the same place, and a field still inviting the next thing rather than
        // shut. Over the working feed and not the vessel alone, because what the render has to
        // settle is whether the amber reads as the one live thing on the screen.
        SpecimenEntry("composerRunning") {
            SpecimenScene.sessions(
                FeedProjection.previewWorkingRows,
                vessel: .composer(ComposerSpecimen.running),
            )
        },
        // The tray at rest, which is where a standing allow has to be findable: the turn AFTER the
        // grant, with the prompt that made it long gone (#572).
        SpecimenEntry("composerStanding") {
            SpecimenScene.sessions(
                FeedProjection.previewRows,
                vessel: .composer(ComposerSpecimen.standing),
            )
        },
    ]

    private static let drafts: [SpecimenEntry] = [
        // A multi-line draft, because the growth past one line is the state — and whether six lines
        // still leave a vessel rather than a wall is the judgement.
        SpecimenEntry("composerTyping") { ComposerSpecimen(draft: ComposerSpecimen.typing) },
        // Past the six-line ceiling, where the field stops growing and scrolls inside itself. The
        // judgement is whether the feed above is still a reading rather than a strip.
        SpecimenEntry("composerCeiling") { ComposerSpecimen(draft: ComposerSpecimen.ceiling) },
        // A draft that survived leaving the Session: simply there, with one quiet line saying it
        // was kept and when. No offer to restore it — nothing was lost (#539).
        SpecimenEntry("composerDraftKept") { ComposerSpecimen(draft: ComposerSpecimen.kept) },
        // A follow-up held above the field while the Turn it waits on runs, cancellable where it
        // stands, and a field inviting the next one rather than a message.
        SpecimenEntry("composerQueued") {
            ComposerSpecimen(composer: ComposerSpecimen.running, draft: ComposerSpecimen.queued)
        },
        // The same chip under a Session with a Turn in flight that does NOT read `running` (#1179)
        // — `starting` here, resolved through the projection rather than stated. Its own entry
        // because it is the case that used to draw nothing at all: the words left the field, went
        // down a busy PTY, and appeared on no chip and in no row. The judgement is that this render
        // is indistinguishable from `composerQueued` above — a follow-up is held the same way
        // whichever word the Session happens to read.
        SpecimenEntry("composerQueuedNotRunning") {
            ComposerSpecimen(composer: ComposerSpecimen.working, draft: ComposerSpecimen.queued)
        },
        // A follow-up overtaking the boundary it was waiting for (#1238) — the second chip steered
        // past the first, drawn mid-Turn because that is the only time the act exists. The
        // judgement is whether SENDING reads as a moment passing rather than as an outcome, and
        // whether a row that has quietly dropped both its controls still looks like a row.
        SpecimenEntry("composerQueueSteering") {
            ComposerSpecimen(
                composer: ComposerSpecimen.running,
                draft: ComposerSpecimen.queueSteering,
            )
        },
        // A release the port refused (#1238), which is the one state where a chip and the seam say
        // one thing together: the reason and its Retry above, and the follow-up the release
        // actually reached marked NOT SENT while the one behind it still reads QUEUED. The
        // judgement is whether the two words separate at a glance without the row growing a second
        // colour scheme.
        SpecimenEntry("composerQueueRefused") {
            ComposerSpecimen(draft: ComposerSpecimen.queueRefused)
        },
        // The other half of #541: the vessel a moment after Stop, the words still in the field and
        // the follow-ups gone, with the one line saying which went. The claim is that the line is
        // quiet enough not to read as a failure and specific enough that nobody reads it as being
        // about the message they can still see.
        SpecimenEntry("composerStopped") { ComposerSpecimen(draft: ComposerSpecimen.stopped) },
        // Stop as a GESTURE rather than as a state — the one entry the composer's e2e presses the
        // control in. It holds the Session's own running flag, so the click walks the whole
        // transition a reader walks: the chip goes, the seam arrives, the circle turns back into
        // an arrow, and the field has to still be the field afterwards.
        SpecimenEntry("composerStopping") { ComposerStoppingSpecimen() },
        // A refused send: the message still where it was typed, the reason on the seam above the
        // vessel, and a way to try again.
        SpecimenEntry("composerRefusal") { ComposerSpecimen(draft: ComposerSpecimen.refused) },
        // The same seam under words nobody at Argo wrote, with the rest of them one gesture away
        // (§5, #1045). Its own entry because the CONTROL is the claim: a line, a way to the whole
        // of it, and a Retry, on a seam that is still one line high.
        SpecimenEntry("composerRefusalAtLength") {
            ComposerSpecimen(draft: ComposerSpecimen.refusedAtLength)
        },
        // A Turn the CLI never heard, put back where it was typed (#682). Beside the refusal above
        // because the two are deliberately NOT the same line: a refusal is a send that did not go
        // and the words never left, while this one went, cleared the field, and came back seconds
        // later. Only a render says whether the quieter ink is right for news that late.
        SpecimenEntry("composerLostTurn") { ComposerSpecimen(draft: ComposerSpecimen.lost) },
        // Three chips over a message that refers to them (#540). A picture, a source file and a log
        // in one tray, because "one chip shape for every source" is a claim about the three of them
        // TOGETHER — a tray holding one kind proves nothing about the sentence.
        SpecimenEntry("composerAttached") { ComposerSpecimen(draft: ComposerSpecimen.attached) },
        // What ⌘V leaves: one chip named for the gesture rather than for a file. Its own entry
        // beside the one above because the judgement is that the two are the SAME chip — a paste
        // reading as a lesser kind of attachment would break the design's one rule.
        SpecimenEntry("composerPasted") { ComposerSpecimen(draft: ComposerSpecimen.pasted) },
        // A file held over the vessel. Only a real drag raises this, so without the entry the
        // dashed rim and the wash the study drew are never actually looked at — and what has to
        // be true is that the WHOLE vessel reads as the target rather than a strip of it.
        SpecimenEntry("composerDragOver") { ComposerSpecimen(isDropTargeted: true) },
        // An adapter that takes none: no `+` on the footer at all, and the seam saying what a drop
        // was refused for. The claim is that an ABSENCE reads as a complete footer rather than as a
        // row a control fell out of (design decision 9).
        SpecimenEntry("composerNoAttach") {
            ComposerSpecimen(
                composer: ComposerSpecimen.noAttach,
                draft: ComposerSpecimen.refusedAttachment,
            )
        },
    ]

    private static let modes: [SpecimenEntry] = [
        // A Session where the ladder has no rung: `claude` in `default`, which unattended reads
        // and nothing else. The claim is that `≈ Read Only` reads as a REPORT about where the
        // Session is rather than as a rung somebody chose (#545, ADR-0025).
        SpecimenEntry("composerModeNearly") { ComposerSpecimen(composer: ComposerSpecimen.nearly) },
        // `dontAsk`, whose boundary is an allowlist Argo cannot see. The word `unknown` sits
        // where a rung would, so what has to be true is that the footer still reads as a footer
        // with a control on it rather than one that failed to load a value.
        SpecimenEntry("composerModeUnknown") {
            ComposerSpecimen(composer: ComposerSpecimen.unknownMode)
        },
        // A rung picked mid-Turn (#940). The Turn is still running — the field invites a follow-up
        // rather than a message — the picker is holding `≈ Auto` with nothing ticked, and the seam
        // says both halves: that the port refused, and that the rung is held rather than dropped.
        SpecimenEntry("composerModeHeld") {
            ComposerSpecimen(
                composer: ComposerSpecimen.running,
                draft: ComposerSpecimen.modeHeld,
            )
        },
        // A rung the CLI did not take (#629). The picker is back on the rung the record reports,
        // and the seam says which one was asked for. What has to be true is that the pair reads
        // as ONE correction rather than as a control that lost the click.
        SpecimenEntry("composerModeRefused") {
            ComposerSpecimen(composer: ComposerSpecimen.modeRefused)
        },
    ]

    private static let absences: [SpecimenEntry] = [
        // A Session Argo never spawned: no vessel at all, and one line where it would have been
        // (#546, design decision 7). What the render has to settle is that the deck reads as
        // FINISHED rather than as one whose composer failed to draw.
        SpecimenEntry("composerExternal") {
            SpecimenScene.sessions(
                FeedProjection.previewRows,
                vessel: .unavailable(.external),
                access: .external,
            )
        },
        // The same absence on a Session that WAS Argo's, with the one act still available on it.
        // The claim is that the exit reads as an offer rather than as a retry of the steering
        // that just died.
        SpecimenEntry("composerOrphaned") {
            SpecimenScene.sessions(
                FeedProjection.previewRows,
                vessel: .unavailable(.orphaned),
                access: .orphaned,
            )
        },
        // Neither of those two: the agent reported itself over while Argo still held its PTY, so
        // the line takes the quiet mark. Its own entry because the judgement is that it does NOT
        // read as a failure — nothing here went wrong.
        SpecimenEntry("composerEnded") {
            SpecimenScene.sessions(FeedProjection.previewRows, vessel: .unavailable(.ended))
        },
    ]

    private static let prompts: [SpecimenEntry] = [
        // A gated command holding the composer's slot: the tool and its target verbatim, the amber
        // rim, Allow focused — the state the whole channel exists to raise.
        SpecimenEntry("permission") {
            SpecimenScene.sessions(
                FeedProjection.previewRows,
                vessel: .prompt(PermissionSpecimen.command),
            )
        },
        // The same prompt on a Session that already holds two grants: the standing offer on the
        // footer's trailing edge, and above it the record of what it makes.
        SpecimenEntry("permissionStanding") {
            SpecimenScene.sessions(
                FeedProjection.previewRows,
                vessel: .prompt(PermissionSpecimen.standing),
            )
        },
        // The other tool kind the prompt renders: a path and the hunk it would write, with the
        // counts said under the block rather than inside it.
        SpecimenEntry("permissionEdit") {
            SpecimenScene.sessions(
                FeedProjection.previewRows,
                vessel: .prompt(PermissionSpecimen.edit),
            )
        },
        // The same shipping gate the composer's glass carries.
        SpecimenEntry("flatPermission") {
            SpecimenScene.sessions(
                FeedProjection.previewRows,
                vessel: .prompt(PermissionSpecimen.command),
            )
            .argoWithoutTransparency()
        },
    ]
}
