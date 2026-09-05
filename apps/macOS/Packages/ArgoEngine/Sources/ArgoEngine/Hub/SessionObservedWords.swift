/// The three words a Session's records report about how it is being run — Model, Effort and
/// stance — verbatim and UNREAD.
///
/// One value because the three are one fact read three times. Each is the CLI's own word rather
/// than a rung on any scale of Argo's: what `observedEffort` means is `ClaudeEffort`'s to say and
/// what `observedMode` means is `ClaudePermissionMode`'s (ADR-0025, #558), so nothing here reads
/// any of them. And each moves under the same rule — latest reading wins, because `/model`,
/// `/effort` and a cycled stance all move mid-session and the file keeps both sides of the move.
///
/// Extracted from `HubSession` rather than declared there (#1267): that type is at the ceiling
/// `.swiftlint.yml` holds it to, and three slots stating one rule three times is where the room
/// was.
struct SessionObservedWords: Equatable, Sendable {
    /// A provider's id off an assistant record, or the alias a `/model` command was handed once
    /// that command confirmed it (`CommandedModel`, #1411) — the same two vocabularies
    /// `HubSession.launchedRun` already holds, and `ReadableModelName` says either the way a person
    /// does.
    var model: String?
    var effort: String?
    var mode: String?

    /// The later half of a resume chain over the earlier one.
    ///
    /// A link that said nothing does not un-state the link before it: a resume file with no
    /// `/model` in it yet is not a Session that has forgotten which model it is on. The same rule
    /// for all three, which is the other half of why they travel together.
    mutating func merge(_ later: Self) {
        model = later.model ?? model
        effort = later.effort ?? effort
        mode = later.mode ?? mode
    }
}
