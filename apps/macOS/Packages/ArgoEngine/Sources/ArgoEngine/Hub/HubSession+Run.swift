/// Reconciling the two things that can say what a Session RUNS AT: the pair Argo started its CLI
/// on, and the pair its records report (#1175).
///
/// Unlike the rung, this needs no record count. A model and an effort are NAMED rather than walked
/// to, and the CLI writes its own reading into the first record it makes — so a record that has
/// spoken at all is the later fact of the two, and the launch value is only ever the opening one.
public extension HubSession {
    /// The model id, verbatim and unread — the record's where one has landed, and otherwise what
    /// Argo put on argv. `nil` for an external Session, which Argo did not start.
    var model: String? {
        observedModel ?? launchedRun?.model
    }

    /// The CLI's own word for the effort level, on the same terms as `model` above. The launch
    /// value is spelled in the CLI's own words too (`ClaudeEffort`), so a reader here cannot tell
    /// which of the two it got — which is the point: both say what the Session is running at.
    var effort: String? {
        observedEffort ?? launchedRun.map { ClaudeEffort.value(for: $0.effort) }
    }
}
