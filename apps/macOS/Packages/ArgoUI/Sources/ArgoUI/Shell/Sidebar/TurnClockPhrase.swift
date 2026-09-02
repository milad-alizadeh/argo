/// How long a Turn has run, drawn and spoken (`cockpit-roster-turn-clock.md` — Measurements).
/// Not `AgePhrase`, which words how long AGO one moment was; this words a duration still growing.
enum TurnClockPhrase {
    private static let minute = 60
    private static let hour = 60 * minute

    /// Whole seconds between two epoch-millisecond moments — the one spelling of that arithmetic.
    static func seconds(sinceMs: Int, nowMs: Int) -> Int {
        (nowMs - sinceMs) / 1000
    }

    /// The drawn figure: `42s`, `4m 12s`, `1h 04m`. Seconds leave past an hour — a Turn that
    /// long is not read to the second. Floored at zero the way `AgePhrase` floors: clock skew
    /// is not a Session running in the future.
    static func figure(seconds: Int) -> String {
        let elapsed = max(seconds, 0)
        return switch elapsed {
        case ..<minute: "\(elapsed)s"
        case ..<hour: "\(elapsed / minute)m \(padded(elapsed % minute))s"
        default: "\(elapsed / hour)h \(padded(elapsed % hour / minute))m"
        }
    }

    /// The same duration for a screen reader, which gets nothing from `04`.
    package static func spoken(seconds: Int) -> String {
        let elapsed = max(seconds, 0)
        return switch elapsed {
        case ..<minute: unit(elapsed, "second")
        case ..<hour: joined(unit(elapsed / minute, "minute"), trailing: elapsed % minute, "second")
        default: joined(unit(elapsed / hour, "hour"), trailing: elapsed % hour / minute, "minute")
        }
    }

    private static func padded(_ value: Int) -> String {
        value < 10 ? "0\(value)" : "\(value)"
    }

    private static func unit(_ count: Int, _ word: String) -> String {
        "\(count) \(word)\(count == 1 ? "" : "s")"
    }

    /// `1 minute`, not `1 minute 0 seconds`: a zero remainder is silence, never a claim.
    private static func joined(_ lead: String, trailing count: Int, _ word: String) -> String {
        count == 0 ? lead : "\(lead) \(unit(count, word))"
    }
}
