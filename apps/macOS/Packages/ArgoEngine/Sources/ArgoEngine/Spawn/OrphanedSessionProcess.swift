import Darwin

/// Process argv with its argument boundaries intact. `ps` flattens those boundaries into prose,
/// where a prompt mentioning `--resume <id>` is indistinguishable from the option itself.
typealias ProcessArguments = @Sendable (Int32) -> [String]?
typealias ProcessSignal = @Sendable (Int32) -> Bool

/// The live Claude process behind a Session whose owning Argo has gone (#1609).
///
/// The Session id on argv is the only join. A working directory never participates: several
/// agents can work in one folder, and ending the wrong one cannot be repaired.
actor OrphanedSessionProcess {
    struct Services: Sendable {
        let run: ShellCommand
        let arguments: ProcessArguments
        let signal: ProcessSignal

        init(
            run: @escaping ShellCommand = shellCommand,
            arguments: @escaping ProcessArguments = processArguments,
            signal: @escaping ProcessSignal = { kill($0, SIGTERM) == 0 },
        ) {
            self.run = run
            self.arguments = arguments
            self.signal = signal
        }
    }

    private let services: Services

    init(services: Services = Services()) {
        self.services = services
    }

    func endClaudeSession(identifiedBy identifiers: Set<String>) -> SessionEndResult {
        guard !identifiers.isEmpty,
              let table = services.run(["ps", "-axo", "pid="])
        else { return .notFound }
        var matches: Set<Int32> = []
        for pid in Set(table.split(whereSeparator: \.isWhitespace).compactMap { Int32($0) }) {
            guard let arguments = services.arguments(pid) else { continue }
            switch identifierMatch(in: arguments, identifiers: identifiers) {
            case .unrelated:
                continue
            case .exact:
                matches.insert(pid)
            case .ambiguous:
                return .ambiguous
            }
        }
        guard matches.count == 1, let pid = matches.first else {
            return matches.isEmpty ? .notFound : .ambiguous
        }
        return services.signal(pid) ? .ended : .signalFailed
    }

    private enum IdentifierMatch {
        case unrelated
        case exact
        case ambiguous
    }

    /// Exactly one identifier option, whose VALUE is one id in the Session's known chain.
    /// Multiple options are themselves ambiguous: choosing which occurrence the CLI honoured
    /// would be another guess about a process Argo no longer owns.
    private func identifierMatch(
        in arguments: [String],
        identifiers: Set<String>,
    )
        -> IdentifierMatch {
        let flags = AgentCLI.claude.processIdentifierFlags
        var optionCount = 0
        var values: [String] = []
        for index in arguments.indices where flags.contains(arguments[index]) {
            optionCount += 1
            let valueIndex = arguments.index(after: index)
            guard valueIndex < arguments.endIndex else { continue }
            values.append(arguments[valueIndex])
        }
        let targetCount = values.count(where: identifiers.contains)
        guard targetCount > 0 else { return .unrelated }
        return optionCount == 1 ? .exact : .ambiguous
    }
}

/// Reads macOS's `KERN_PROCARGS2` record, the process source that preserves argv boundaries.
private let processArguments: ProcessArguments = { pid in
    var maximum = Int32(0)
    var maximumSize = MemoryLayout.size(ofValue: maximum)
    var maximumMIB = [CTL_KERN, KERN_ARGMAX]
    let maximumStatus = maximumMIB.withUnsafeMutableBufferPointer { mib in
        sysctl(mib.baseAddress, u_int(mib.count), &maximum, &maximumSize, nil, 0)
    }
    guard maximumStatus == 0, maximum > 0 else { return nil }

    var bytes = [UInt8](repeating: 0, count: Int(maximum))
    var byteCount = bytes.count
    var processMIB = [CTL_KERN, KERN_PROCARGS2, pid]
    let processStatus = processMIB.withUnsafeMutableBufferPointer { mib in
        bytes.withUnsafeMutableBytes { buffer in
            sysctl(mib.baseAddress, u_int(mib.count), buffer.baseAddress, &byteCount, nil, 0)
        }
    }
    guard processStatus == 0 else { return nil }
    return decodeProcessArguments(bytes, count: byteCount)
}

/// `KERN_PROCARGS2`: argc, executable path, NUL padding, then argc NUL-terminated arguments.
private func decodeProcessArguments(_ bytes: [UInt8], count: Int) -> [String]? {
    let headerSize = MemoryLayout<Int32>.size
    guard count >= headerSize, count <= bytes.count else { return nil }
    var argumentCount = Int32(0)
    withUnsafeMutableBytes(of: &argumentCount) { destination in
        destination.copyBytes(from: bytes.prefix(headerSize))
    }
    guard argumentCount > 0 else { return nil }

    var cursor = headerSize
    while cursor < count, bytes[cursor] != 0 {
        cursor += 1
    }
    while cursor < count, bytes[cursor] == 0 {
        cursor += 1
    }

    var arguments: [String] = []
    for _ in 0 ..< Int(argumentCount) {
        let start = cursor
        while cursor < count, bytes[cursor] != 0 {
            cursor += 1
        }
        guard cursor < count else { return nil }
        guard let argument = String(bytes: bytes[start ..< cursor], encoding: .utf8) else {
            return nil
        }
        arguments.append(argument)
        cursor += 1
    }
    return arguments
}
