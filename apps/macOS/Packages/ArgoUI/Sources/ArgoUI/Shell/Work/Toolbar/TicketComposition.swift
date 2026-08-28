import ArgoEngine

/// What has been typed into the New ticket composer, before any of it is a ticket (#872).
///
/// A VALUE the composer is opened WITH and edits, held above the sheet: a refused create returns
/// the reader to their own words rather than to an empty field, and the sheet is rebuilt on every
/// pass of the shell.
struct TicketComposition: Equatable {
    var title = ""
    var body = ""

    /// The draft this composes to, and `nil` while there is nothing a provider would take. Every
    /// provider refuses a ticket with no title, so the control says so before the wire rather than
    /// spending a round trip to be told (`TicketSurface` — a capability decides whether an
    /// affordance exists; this decides whether there is anything to send).
    ///
    /// The body is dropped where it is blank rather than sent empty: absent and empty are one state
    /// on a ticket body, and `nil` is the one that says nothing was written.
    var draft: TicketDraft? {
        let title = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return nil }
        let body = body.trimmingCharacters(in: .whitespacesAndNewlines)
        return TicketDraft(title: title, body: body.isEmpty ? nil : body)
    }
}
