import ArgoEngine

extension WorkRoomProjection {
    /// The four views, over the open set the deck draws. Unblocked and Blocked PARTITION it —
    /// `WorkItemBlockage` has three cases and only `.clear` is unblocked, so a stranded item is
    /// counted as blocked rather than falling between the two.
    static func views(of open: [WorkItem], claimed: Set<Int>) -> [ViewReading] {
        let blocked = open.filter { $0.blockage != .clear }.count
        return [
            ViewReading(id: .allOpen, count: open.count),
            ViewReading(id: .unblocked, count: open.count - blocked),
            ViewReading(id: .inProgress, count: open.filter { claimed.contains($0.number) }.count),
            ViewReading(id: .blocked, count: blocked),
        ]
    }

    static func charts(of reading: WorkReading, open: [WorkItem]) -> [ChartReading] {
        let openNumbers = Set(open.map(\.number))
        return reading.charts.compactMap { number in
            guard let parent = reading.items.first(where: { $0.number == number }) else {
                return nil
            }
            return ChartReading(
                id: number,
                name: "#\(number) \(shortName(of: parent.title))",
                count: parent.children.filter(openNumbers.contains).count,
            )
        }
    }

    static func row(for item: WorkItem, delivery: DeliveryReading?, closed: Set<Int>) -> Row {
        Row(
            id: item.number,
            title: item.title,
            delivery: delivery ?? .absent,
            trailing: rollUp(of: item, closed: closed),
        )
    }

    static func ticket(in reading: WorkReading) -> Ticket? {
        guard let number = reading.showing,
              let item = reading.items.first(where: { $0.number == number })
        else { return nil }
        return Ticket(
            id: number,
            title: item.title,
            status: item.status,
            bucket: item.state(claimed: reading.claimed.contains(number)),
            body: reading.bodies[number],
        )
    }

    private static func rollUp(of item: WorkItem, closed: Set<Int>) -> String? {
        guard !item.children.isEmpty else { return nil }
        return "\(item.children.filter(closed.contains).count)/\(item.children.count)"
    }

    /// What a chart is listed by: the head of its title, cut at the punctuation a ticket title uses
    /// to introduce its own subtitle. The rail has room for the name, never the sentence.
    private static func shortName(of title: String) -> String {
        let head = title.prefix { $0 != ":" && $0 != "—" }
        return head.trimmingCharacters(in: .whitespaces)
    }
}
