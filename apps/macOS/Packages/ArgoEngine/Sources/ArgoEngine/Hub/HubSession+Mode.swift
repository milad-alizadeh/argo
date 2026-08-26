/// Reconciling the two things that can say what rung a Session stands on: the one Argo put it on,
/// and the one its record last wrote (ADR-0025). They disagree often enough to be their own read.
public extension HubSession {
    /// The Session's standing stance, as Argo can state it.
    var mode: SessionModeReading {
        guard let modeSet else {
            return observedMode.map(stance.reading(of:)) ?? .unknown(cli: nil)
        }
        // Nothing has been written since Argo set the rung, and `claude` writes its stance only at
        // Turn boundaries — so the rung Argo put the Session on is the later fact of the two.
        guard observedModeCount > modeSet.recordsWhenSet, let observedMode else {
            return .exactly(modeSet.mode, cli: stance.value(for: modeSet.mode))
        }
        // The record has spoken since, so it is what is true — except for Plan, which no CLI can
        // report: it reports Read Only's boundary either way, and the intent is knowable only from
        // the set.
        guard modeSet.mode == .plan, observedMode == stance.value(for: .plan) else {
            return stance.reading(of: observedMode)
        }
        return .exactly(.plan, cli: observedMode)
    }

    /// The rung Argo asked for and the CLI then contradicted, and `nil` for every ordinary reading
    /// (#629).
    ///
    /// Only a record written AFTER the set can make this claim: before one, silence is not
    /// disagreement. It exists because the correction is otherwise invisible — `mode` above snaps
    /// to the real rung the moment the record lands, and nothing else would say why the control
    /// moved on its own.
    var modeDidNotTake: SessionMode? {
        guard let modeSet, observedModeCount > modeSet.recordsWhenSet, let observedMode,
              stance.value(for: modeSet.mode) != observedMode
        else { return nil }
        return modeSet.mode
    }
}

extension HubSession {
    /// The words THIS Session's CLI states a stance in (#749) — never one CLI's for both.
    private var stance: any AgentStanceVocabulary.Type {
        cli.stance
    }
}
