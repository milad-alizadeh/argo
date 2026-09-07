/// The running list every plan write in a record implies, whichever way the host writes one.
///
/// Claude Code writes `TaskCreate`/`TaskUpdate`: one entry at a time, addressed by an id only the
/// create's own RESULT reports. The list exists nowhere in the record; it is the fold of every
/// write before it. `TodoWrite` hands the whole list over entire and needs no fold — it goes
/// through here anyway, so that one rule below holds for BOTH: a call writes its list once, and a
/// second reading of the same call writes nothing.
///
/// It answers each write with the WHOLE list, which keeps ADR-0020 true downstream: the newest plan
/// is still the whole of it.
struct PlanLedger {
    /// One entry, plus the two names it answers to: `callID` is Argo's own id for the call that
    /// wrote it, and `taskID` is the host's, which is what an update addresses. The host's is
    /// absent between a create and its result, and stays absent for a create nothing answered —
    /// that entry is on the list and nothing can move it.
    private struct Entry {
        let callID: String
        let text: String
        var taskID: String?
        var status: PlanEntryStatus
    }

    private var entries: [Entry] = []
    /// The calls already folded. A file is read twice over — once for its plan writes alone
    /// (`TranscriptPlanScan`), then for its two ends — and a record in both is ONE write seen
    /// twice, not two. Folding it again would append a second entry for a create, and, worse, take
    /// a status back to what an earlier update said (#1594).
    private var folded: Set<String> = []

    /// One call → the whole list as it stands after it, or `nil` for a call that wrote nothing to
    /// it. A tool this does not name — `TaskStop`, which belongs to a background agent task and not
    /// to this list — falls through to `nil` and stays whatever news it already was. So does a call
    /// this ledger has already folded.
    mutating func written(by use: ToolUseBlock) -> Plan? {
        switch use.name {
        case taskCreateTool: firstReading(of: use) ? created(by: use) : nil
        case taskUpdateTool: firstReading(of: use) ? updated(by: use) : nil
        case planTool: firstReading(of: use) ? plan(from: use.input) : nil
        default: nil
        }
    }

    /// Whether this call is being folded for the first time. Only the tools that write a list are
    /// remembered: a Session makes thousands of other calls and none of them is this ledger's.
    private mutating func firstReading(of use: ToolUseBlock) -> Bool {
        folded.insert(use.id).inserted
    }

    /// Every plan write ONE record made, in the order it made them. The last one is the list as
    /// that record left it, and `nil` says the record wrote no list at all.
    ///
    /// A SIDECHAIN record writes nothing: the Plan is Session-scoped (ADR-0020), and a delegate's
    /// to-do list folded into its parent's cannot be taken back out — an incremental list is never
    /// replaced whole by the next write. `TranscriptReader.attributes` is the same guard, spelled
    /// where that reader can also see whose Turn it is.
    mutating func written(by message: MessageRecord) -> Plan? {
        guard !message.authorship.isSidechain else { return nil }
        return message.content.reduce(into: nil) { latest, block in
            guard case let .toolUse(use) = block else { return }
            latest = written(by: use) ?? latest
        }
    }

    /// The ids this record's results reported. No list of its own: an entry learning the name
    /// updates will address it by is not a change to the one being drawn.
    mutating func identify(from message: MessageRecord) {
        for block in message.content {
            guard case let .toolResult(result) = block else { continue }
            identify(call: result.toolUseId, from: message.toolUseResult)
        }
    }

    /// The id a create's result reported, joined onto the entry that create made — the only place
    /// an id is ever written. A result quoting a call this ledger never made is left alone.
    mutating func identify(call callID: String, from toolUseResult: JSONValue?) {
        guard let id = toolUseResult?[taskResultKey]?.stringField(taskResultIDKey),
              let index = entries.firstIndex(where: { $0.callID == callID }) else { return }
        entries[index].taskID = id
    }

    /// An entry with no subject is dropped rather than shown blank.
    private mutating func created(by use: ToolUseBlock) -> Plan? {
        guard let text = use.input.stringField(taskSubjectKey) else { return nil }
        entries.append(Entry(callID: use.id, text: text, taskID: nil, status: .pending))
        return list()
    }

    /// A rewording is not a status, and the entry it names keeps the one it has. An update naming a
    /// task the record never created moves nothing and reports nothing.
    private mutating func updated(by use: ToolUseBlock) -> Plan? {
        guard let status = writtenPlanEntryStatus(use.input.stringField(taskStatusKey)),
              let named = use.input.stringField(taskIDKey),
              let index = entries.firstIndex(where: { $0.taskID == named }) else { return nil }
        entries[index].status = status
        return list()
    }

    private func list() -> Plan {
        Plan(entries: entries.map { PlanEntry(text: $0.text, status: $0.status) })
    }
}
