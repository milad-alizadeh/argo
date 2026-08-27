import ArgoEngine

extension WorkRoomProjection {
    /// The four views, counted over the whole open set — never over the view on screen, or opening
    /// `Blocked` would leave every other count reading its own filter back.
    ///
    /// `Unblocked` and `Blocked` partition the open set and always sum to `All open`
    /// (`cockpit-work-room.md`), so the pair can only be counted where EVERY open ticket's edges
    /// were read. Where one was not, both counts are absent rather than short: a number that has
    /// silently dropped the tickets nobody asked about is worse than no number.
    static func views(of open: [WorkItem], claimed: Set<Int>) -> [ViewReading] {
        let edged = open.allSatisfy { $0.blockage != .unread }
        return WorkView.allCases.map { view in
            guard edged || !view.restsOnEdges else {
                return ViewReading(id: view, count: nil)
            }
            return ViewReading(id: view, count: items(of: open, in: view, claimed: claimed).count)
        }
    }

    /// The open items one view holds. The list and the count beside it both come through here.
    static func items(of open: [WorkItem], in view: WorkView, claimed: Set<Int>) -> [WorkItem] {
        open.filter { view.admits($0, claimed: claimed.contains($0.number)) }
    }

    /// The `CHARTS` group, in the order the provider served its items (`WorkItem.isChartShaped`).
    static func charts(of reading: WorkReading, open: [WorkItem]) -> [ChartReading] {
        let openNumbers = Set(open.map(\.number))
        return reading.items
            .filter(\.isChartShaped)
            .map { parent in
                ChartReading(
                    id: parent.number,
                    name: "#\(parent.number) \(shortName(of: parent.title))",
                    count: parent.children.filter(openNumbers.contains).count,
                )
            }
    }

    /// The parent's `n/m`, over the TRACKER's children rather than the rows drawn under it.
    static func rollUp(of item: WorkItem, closed: Set<Int>) -> String? {
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
