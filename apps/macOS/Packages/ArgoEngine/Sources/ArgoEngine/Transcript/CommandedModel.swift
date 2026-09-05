import Foundation

/// The model a `/model` command put the Session on, read off the two records the command leaves
/// behind (#1411).
///
/// `/model` is a local command: the CLI runs it itself, and the next record naming a model is the
/// one a provider answers with when a Turn finally opens. Nothing between the two moved the
/// reading, so the footer went on naming the model the Session had just left — for good, where the
/// Turn after it was interrupted.
///
/// The reading is the command's ARGUMENT, released only by the command's own output: the argument
/// is what was asked and the output is the CLI saying it took it, so a `/model` the CLI refused —
/// which prints no such line — moves nothing.
///
/// The argument and not the name the output prints, because what a Session runs at is spent on
/// `--model` when the chain is resumed (`Hub+Resume` into `AgentCLI`), and `opus` is a value that
/// flag takes where `Opus 5 (1M context)` is not. It is the vocabulary `launchedRun` already
/// holds, on the same staleable-by-construction terms: a word the CLI stops resolving stops
/// working, and `ReadableModelName` says it as `Opus 5` meanwhile.
///
/// Two things this therefore does NOT read. A bare `/model`, whose picker names the model in the
/// printed line alone — that line is a DISPLAY name, and putting one where `--model` is spent
/// would break the resume to fix the footer. And a Session whose CLI took an argument it spells
/// differently: the reading is then what was asked rather than what was set, which is the same
/// word the launch alias is trusted on.
enum CommandedModel {
    /// The CLI's own name for the command, as the record spells it.
    private static let command = "/model"

    /// The two sentences `/model` prints when a model is set. `Kept model as` is what the picker
    /// writes when it closed on the model the Session was already on — a weaker event and the same
    /// claim, so it releases the argument the same way.
    ///
    /// Matched at the HEAD, the discipline `skillDirectory` uses: a command whose output merely
    /// QUOTES the sentence has not set anything.
    private static let reports = ["Set model to ", "Kept model as "]

    /// The model this record's `/model` asked the CLI for, or `nil` where it is not one.
    ///
    /// Verbatim: an alias as readily as a full id, because both are what `--model` and `/model`
    /// take, and normalising here would be Argo deciding which models exist (#558).
    static func asked(in content: [ContentBlock]) -> String? {
        guard let invocation = commandInvocation(content), invocation.name == command
        else { return nil }
        return ModelID.named(in: invocation.args)
    }

    /// Whether this record is `/model` reporting that the Session now stands on a model.
    static func reportsASet(in content: [ContentBlock]) -> Bool {
        guard let printed = localCommandOutput(content) else { return false }
        return reports.contains(where: printed.hasPrefix)
    }
}
