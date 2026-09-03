import ArgoEngine
import ArgoUI

/// The Sessions the run-facts cases are drawn against (#558) — the base fixture varied by the one
/// thing each case is about: off the defaults, off Argo's own tables, and one knob declared.
///
/// Beside the other fixtures rather than among them, for the reason they are beside the specimen:
/// one catalogue per subject keeps each under the file ceiling.
extension ComposerSpecimen {
    /// The same Session off BOTH defaults (#558): the fact line brightens, and the reset comes
    /// alive naming all three of what it restores. `Auto` on the Mode beside it, which is the
    /// third thing the reset moves and the reason its inertness reads Mode too.
    static let runFactsChanged = SessionComposerProjection.Composer(
        sessionID: composer.sessionID,
        placeholder: composer.placeholder,
        facts: RunFacts(
            model: "claude-sonnet-5",
            effort: .exactly(.xhigh, cli: "xhigh"),
            chooses: .both,
        ),
        standingAllows: [],
        isRunning: false,
        mode: .exactly(.auto, cli: "auto"),
        modeDidNotTake: nil,
        lostTurn: nil,
        canAttach: true,
        canRunCommands: false,
    )

    /// A Session on a model and a level Argo's own tables have never heard of (#558, criterion 2).
    /// Both are stated VERBATIM: the model earns a row of its own so the tick has somewhere to
    /// land, and the level ticks no segment at all rather than rounding to a neighbour.
    static let runFactsUnread = SessionComposerProjection.Composer(
        sessionID: composer.sessionID,
        placeholder: composer.placeholder,
        facts: RunFacts(
            model: "claude-mythos-7",
            effort: .unknown(cli: "ludicrous"),
            chooses: .both,
        ),
        standingAllows: [],
        isRunning: false,
        mode: composer.mode,
        modeDidNotTake: nil,
        lostTurn: nil,
        canAttach: true,
        canRunCommands: false,
    )

    /// An adapter declaring ONE knob (#558, criterion 4). The Model section is absent rather than
    /// greyed — a control that cannot work gives no reason for not working.
    static let runFactsEffortOnly = SessionComposerProjection.Composer(
        sessionID: composer.sessionID,
        placeholder: composer.placeholder,
        facts: RunFacts(
            model: "claude-opus-5",
            effort: .exactly(.high, cli: "high"),
            chooses: RunFactKnobs(effort: true),
        ),
        standingAllows: [],
        isRunning: false,
        mode: composer.mode,
        modeDidNotTake: nil,
        lostTurn: nil,
        canAttach: true,
        canRunCommands: false,
    )
}
