import Foundation

/// The walk down the events that places the frames: a stack of blocks still open, and the finished
/// frames it has closed so far.
///
/// Every event tells whichever blocks are open which lifelines they now have to reach, so a frame's
/// span is exactly what it contains — a block closing over a participant it never mentions is the
/// one mistake a reader would see immediately.
struct MermaidFrameWalk {
    let stage: MermaidStage
    /// Every block that has closed, and where. NOT placed yet, and that is the point: a frame's
    /// inset is measured against `deepest`, which is not known until the whole walk is done — so
    /// placing a frame the moment its `end` is read would inset two blocks at the same depth
    /// differently depending on which of them the source wrote first.
    private(set) var closed: [(frame: MermaidOpenFrame, at: Int)] = []
    private var stack: [MermaidOpenFrame] = []
    /// The deepest the stack ever went. A frame is inset by how far it stands from that, so an
    /// inner frame is drawn inside its outer one rather than on top of it.
    private(set) var deepest = 0

    init(stage: MermaidStage) {
        self.stage = stage
    }

    mutating func step(_ event: MermaidSequence.Event, at index: Int) {
        touch(columns(of: event))
        switch event {
        case .opens:
            stack.append(MermaidOpenFrame(opened: index, depth: stack.count + 1))
            deepest = max(deepest, stack.count)
        case .divides:
            guard !stack.isEmpty else { return }
            stack[stack.count - 1].dividers.append(index)
        case .closes:
            close(at: index)
        case .message, .note, .activate, .deactivate:
            break
        }
    }

    /// A block nobody closed runs to the foot of the diagram. The reader refuses an unbalanced
    /// source, so this is reached only by a caller that built a model by hand.
    mutating func closeRest() {
        while !stack.isEmpty {
            close(at: stage.diagram.events.count)
        }
    }

    /// Every closed block, placed — once the walk is over and `deepest` is final.
    var frames: [MermaidFrame] {
        closed.map { placed($0.frame, closedAt: $0.at) }
    }

    private mutating func close(at index: Int) {
        guard let open = stack.popLast() else { return }
        closed.append((open, index))
        // The outer frame contains the inner one, so it inherits everything the inner one reached.
        if let columns = open.columns, !stack.isEmpty {
            stack[stack.count - 1].touch([columns.lowerBound, columns.upperBound])
        }
    }

    private mutating func touch(_ columns: [Int]) {
        guard !columns.isEmpty else { return }
        for at in stack.indices {
            stack[at].touch(columns)
        }
    }

    /// Which lifelines an event stands on. A frame containing nothing but blocks reaches nowhere of
    /// its own and takes what those blocks reached when they closed.
    private func columns(of event: MermaidSequence.Event) -> [Int] {
        let diagram = stage.diagram
        switch event {
        case let .message(message):
            return [message.from, message.to].compactMap(diagram.column(of:))
        case let .note(note):
            return note.over.compactMap(diagram.column(of:))
        case let .activate(name), let .deactivate(name):
            return [name].compactMap(diagram.column(of:))
        case .opens, .divides, .closes:
            return []
        }
    }
}
