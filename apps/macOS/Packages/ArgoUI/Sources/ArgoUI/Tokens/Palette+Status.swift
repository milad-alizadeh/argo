import SwiftUI

/// The state colours: one value per meaning, across every family.
///
/// A failure is a failure whether it is a failed check, a blocked ticket or a bad signal,
/// and the same holds for the gold that asks for you. Two steps of the same hue read as
/// sloppiness rather than as hierarchy, so these three anchors deliberately override the
/// rule that colour families stay disjoint.
///
/// On dark the anchors sit at the 300 step: a failure, or a request for you, is the
/// brightest thing in its region. That is how "attention is brightness" is spelled.
public extension Palette {
    static let statusFail = Ramp.terracotta300
    static let statusAttention = Ramp.gold300
    static let statusOk = Ramp.moss300

    // MARK: - Roster tones

    /// Named for the TONE the delivery derivation emits, not for a lifecycle state, because
    /// tone and state are not 1:1 — the roster keeps colour off the state on purpose.
    static let toneRun = Ramp.teal500
    static let toneGray = Ramp.bone500
    static let toneAmber = statusAttention
    static let toneStale = Ramp.slate600
    static let toneRed = statusFail
    static let toneDone = Ramp.slate500
    /// Landed (Merged) is moss pulled toward gold, so it reads as neither approve-moss nor
    /// done-slate (ADR-0009).
    static let toneLanded = Ramp.moss500.mix(with: Ramp.gold500, by: 0.45, in: .device)

    // MARK: - Review verdicts

    /// The same three anchors as every other family: a verdict is a state, not its own
    /// palette. The `tint` steps are the fill behind a verdict, one rung deeper so the word
    /// on top of it stays the brightest thing in the block.
    static let verdictApprove = statusOk
    static let verdictChanges = statusAttention
    static let verdictBlock = statusFail
    static let verdictApproveTint = Ramp.moss500
    static let verdictChangesTint = Ramp.gold500
    static let verdictBlockTint = Ramp.terracotta500

    // MARK: - Signals

    static let signalOk = statusOk
    static let signalWarn = statusAttention
    static let signalBad = statusFail

    // MARK: - Code

    /// The syntax palette: the 300 rung throughout, the ramps' lightest chromatic step.
    ///
    /// Brighter than anywhere else in the cockpit spends these hues, because a diff is the
    /// one surface read line by line rather than glanced at. The mid-ramp steps that make a
    /// roster chip sit back make code illegible, and code is also the only text sitting on a
    /// tinted row (the add/delete bands), which costs another step of contrast.
    static let codeForeground = Ramp.bone200
    static let codeComment = Ramp.bone500
    static let codeKeyword = Ramp.terracotta300
    static let codeString = Ramp.moss300
    static let codeConstant = Ramp.teal300
    static let codeFunction = Ramp.gold300
    static let codeParameter = Ramp.bone200
    static let codePunctuation = Ramp.slate300
    static let codeLink = Ramp.gold300
}
