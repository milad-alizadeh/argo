/// The running list a host that writes its plan ONE ENTRY AT A TIME implies.
///
/// `TodoWrite` handed the whole list over on every write, so the reader had nothing to remember —
/// which is the shape ADR-0020 was written against. Claude Code writes `TaskCreate`/`TaskUpdate`
/// instead: one entry at a time, addressed by an id only the create's own RESULT reports. So the
/// list exists nowhere in the record; it is the fold of every write before it, and this is that
/// fold.
///
/// It answers each write with the WHOLE list, which is what keeps ADR-0020 true downstream: the
/// newest plan is still the whole of it, `PlanProjection` still takes the last one it sees, and
/// nothing past this type knows which host wrote it.
struct PlanLedger {
    /// One entry, plus the two names it answers to. `id` is what an update addresses, and it is
    /// absent between a create and its result — and stays absent for a create the record never
    /// answered. That entry is on the list and nothing can move it, which is the honest reading:
    /// the ids run in creation order, and taking that for a rule would address it by a guess.
    private struct Entry {
        let callID: String
        let text: String
        var id: String?
        var status: PlanEntryStatus
    }

    private var entries: [Entry] = []

    /// One call → the whole list as it stands after it, or `nil` for a call that wrote nothing to
    /// it. A tool this does not name — `TaskStop`, which belongs to a background agent task and not
    /// to this list — falls through to `nil` and stays whatever news it already was.
    mutating func written(by use: ToolUseBlock) -> Plan? {
        switch use.name {
        case taskCreateTool: created(by: use)
        case taskUpdateTool: updated(by: use)
        default: nil
        }
    }

    /// The id a create's result reported, joined onto the entry that create made.
    ///
    /// The only place an id is ever written. A result quoting a call this ledger never made — a
    /// resumed chain, or any other tool's result — matches nothing and is left alone.
    mutating func identify(call callID: String, from toolUseResult: JSONValue?) {
        guard let id = toolUseResult?["task"]?.stringField("id"),
              let index = entries.firstIndex(where: { $0.callID == callID }) else { return }
        entries[index].id = id
    }

    /// An entry with no subject is dropped rather than shown blank — the same reading a `TodoWrite`
    /// entry with no `content` already gets, and for the same reason.
    private mutating func created(by use: ToolUseBlock) -> Plan? {
        guard let text = use.input.stringField(taskSubjectKey) else { return nil }
        entries.append(Entry(callID: use.id, text: text, id: nil, status: .pending))
        return plan()
    }

    /// A rewording is not a status, and the entry it names keeps the one it has. An update naming a
    /// task the record never created moves nothing and reports nothing — a plan re-emitted
    /// unchanged would say the agent wrote something when it wrote nothing here.
    private mutating func updated(by use: ToolUseBlock) -> Plan? {
        guard let status = writtenPlanEntryStatus(use.input.stringField(taskStatusKey)),
              let named = use.input.stringField(taskIDKey),
              let index = entries.firstIndex(where: { $0.id == named }) else { return nil }
        entries[index].status = status
        return plan()
    }

    private func plan() -> Plan {
        Plan(entries: entries.map { PlanEntry(text: $0.text, status: $0.status) })
    }
}
