import Foundation

/// GitHub Issues as the write half of the Ticket port (#257, #167).
///
/// **A bare tracker.** Open-and-closed is the whole of the workflow it expresses, so `inProgress`
/// and `inReview` are declared unavailable rather than collapsed onto a state GitHub never holds.
extension GitHubTickets: TicketWriting {
    public var surface: TicketSurface {
        TicketSurface(writes: Set(TicketWrite.allCases), states: [.todo, .done, .closed])
    }

    public func create(
        _ draft: TicketDraft, through binding: ResolvedBinding,
    ) async throws
        -> Ticket {
        let path = "/repos/\(binding.binding.scope)/issues"
        let filed = try await send(.filing(path, draft.fields), at: path, through: binding)
        guard let parent = draft.parent else { return try await adopted(filed, through: binding) }
        // GitHub files a ticket and parents it separately, so a failure here leaves a ticket that
        // exists and is not yet a child — and unadopted, so the room only shows it at the next
        // tick.
        return try await apply(.setParent(parent), to: filed.number, through: binding)
    }

    public func apply(
        _ intent: TicketIntent, to number: Int, through binding: ResolvedBinding,
    ) async throws
        -> Ticket {
        guard surface.offers(intent.write) else {
            throw TicketWriteError.unavailable(intent.write)
        }
        if case let .transitionTo(state) = intent, !surface.states.contains(state) {
            throw TicketWriteError.inexpressible(state)
        }
        if case let .setPriority(word) = intent {
            return try await setPriority(word, to: number, through: binding)
        }
        let request = try await request(intent, to: number, through: binding)
        let written = try await send(
            request, at: path(of: number, through: binding), through: binding,
        )
        return try await adopted(written, through: binding)
    }

    /// Priority, which GitHub has no field for and this adapter already READS off a scoped label
    /// (`GitHubIssue+Priority`). Written back the same way, because a fact the room draws and a
    /// control cannot change is an affordance that lies about which of the two is authoritative.
    ///
    /// The old label goes first, whatever the repository spelled it with, so a ticket cannot end up
    /// carrying two priority labels — which the read resolves to none.
    private func setPriority(
        _ word: String?, to number: Int, through binding: ResolvedBinding,
    ) async throws
        -> Ticket {
        let path = path(of: number, through: binding)
        let issue: GitHubIssue = try await writes.read(path, grant: binding.grant)
        for label in issue.labels.map(\.name) where GitHubIssue.priorityWord(in: label) != nil {
            _ = try await writes.send(
                .delete("\(path)/labels/\(Self.escaped(label))"), grant: binding.grant,
            )
        }
        if let word {
            _ = try await writes.send(
                .post("\(path)/labels", ["labels": [GitHubIssue.priorityLabel(for: word)]]),
                grant: binding.grant,
            )
        }
        return try await adopted(number, through: binding)
    }

    /// Send one write and answer with the ticket the PROVIDER holds afterwards — its own reply
    /// where that reply is the ticket, and a read back through the same path a listing uses where
    /// it is not.
    private func send(
        _ request: GitHubWriteRequest, at path: String, through binding: ResolvedBinding,
    ) async throws
        -> GitHubIssue {
        let reply = try await writes.send(request, grant: binding.grant)
        return try await writes.issue(
            from: request.adoptable(reply), at: path, grant: binding.grant,
        )
    }

    private func adopted(_ number: Int, through binding: ResolvedBinding) async throws -> Ticket {
        let issue: GitHubIssue = try await writes.read(
            path(of: number, through: binding), grant: binding.grant,
        )
        return try await adopted(issue, through: binding)
    }

    /// The issue as a Ticket, edges and all — the same shape a poll produces, so an adopted
    /// ticket and a listed one can never be told apart by what they carry.
    private func adopted(
        _ issue: GitHubIssue, through binding: ResolvedBinding,
    ) async throws
        -> Ticket {
        do {
            return try await ticket(issue, in: binding.binding.scope, grant: binding.grant)
        } catch let error as ProviderFetchError {
            throw TicketWriteError.unreachable(error)
        }
    }
}
