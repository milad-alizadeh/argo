import Foundation

public extension Ticket {
    /// The same ticket with some of its facts replaced, so a caller changing one does not have to
    /// name the other eleven — which is how a copy comes to drop the field added after it.
    ///
    /// A doubled optional per absent-able fact, so "clear this word" and "leave it alone" stay
    /// tellable apart: `.some(nil)` clears, and passing nothing keeps.
    init(
        copying item: Ticket,
        title: String? = nil,
        status: String? = nil,
        labels: [TicketLabel]? = nil,
        closure: TicketClosure? = nil,
        priority: String?? = nil,
        type: String?? = nil,
        blockedBy: [TicketBlocker]?? = nil,
        body: String?? = nil,
        updatedAt: Date?? = nil,
    ) {
        self.init(
            number: item.number,
            title: title ?? item.title,
            status: status ?? item.status,
            closure: closure ?? item.closure,
            assignees: item.assignees,
            labels: labels ?? item.labels,
            priority: priority ?? item.priority,
            type: type ?? item.type,
            children: item.children,
            blockedBy: blockedBy ?? item.blockedBy,
            body: body ?? item.body,
            updatedAt: updatedAt ?? item.updatedAt,
        )
    }
}
