import ArgoEngine

extension WorkRoomProjection {
    /// The four views, counted over the whole open set — never over the view on screen, or opening
    /// `Blocked` would leave every other count reading its own filter back.
    static func views(of open: [WorkItem], claimed: Set<Int>) -> [ViewReading] {
        WorkView.allCases.map { view in
            ViewReading(id: view, count: items(of: open, in: view, claimed: claimed).count)
        }
    }

    /// The open items one view holds. The list and the count beside it both come through here.
    static func items(of open: [WorkItem], in view: WorkView, claimed: Set<Int>) -> [WorkItem] {
        open.filter { view.admits($0, claimed: claimed.contains($0.number)) }
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
