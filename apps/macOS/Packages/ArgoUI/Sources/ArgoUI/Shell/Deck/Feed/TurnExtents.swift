/// Where a reading breaks into Turns, as row ranges.
///
/// Two boundaries and no others: a prompt opens a Turn, and a stop-reason row closes one. So a
/// stretch with no prompt at all is still a Turn, and a stop-reason row belongs to the Turn it
/// ended rather than to the one after it.
///
/// The rule lives HERE rather than in either surface that needs it, because the overview lane draws
/// blocks by it (#382) and the feed's Copy Turn takes its text by it (#734): two copies of it would
/// eventually disagree, and the reader would be told the lane's Turn and handed the feed's.
enum TurnExtents {
    /// A reading as this rule reads it: how many rows, and which of them are boundaries. A value
    /// rather than three arguments, so both verbs below take one thing and the caller states the
    /// reading once.
    struct Reading {
        let count: Int
        let opensTurn: (Int) -> Bool
        let endsTurn: (Int) -> Bool
    }

    /// Every span, in reading order. What the lane wants: it draws all of them at once.
    static func spans(of reading: Reading) -> [ClosedRange<Int>] {
        var spans: [ClosedRange<Int>] = []
        var head = 0
        for index in 0 ..< reading.count {
            // A prompt after the head opens the next Turn, so what came before it is closed here.
            if reading.opensTurn(index), index > head {
                spans.append(head ... index - 1)
                head = index
            }
            if reading.endsTurn(index) {
                spans.append(head ... index)
                head = index + 1
            }
        }
        if head < reading.count {
            spans.append(head ... reading.count - 1)
        }
        return spans
    }

    /// The ONE span a row falls in, walked outwards from it. What a right-click wants: the whole
    /// sweep over a reading of many thousand rows, per cell, is the class of cost the feed already
    /// fights, and this walks one Turn instead.
    static func span(holding row: Int, of reading: Reading) -> ClosedRange<Int>? {
        guard (0 ..< reading.count).contains(row) else { return nil }
        return head(from: row, of: reading) ... foot(from: row, of: reading)
    }

    /// Up to the prompt that opened this Turn, or to the row after the one that closed the last.
    private static func head(from row: Int, of reading: Reading) -> Int {
        var head = row
        while head > 0, !reading.opensTurn(head), !reading.endsTurn(head - 1) {
            head -= 1
        }
        return head
    }

    /// Down to the stop reason that closed this Turn, or to the row before the next prompt.
    private static func foot(from row: Int, of reading: Reading) -> Int {
        guard !reading.endsTurn(row) else { return row }
        var foot = row
        while foot + 1 < reading.count, !reading.opensTurn(foot + 1) {
            foot += 1
            if reading.endsTurn(foot) {
                return foot
            }
        }
        return foot
    }
}
