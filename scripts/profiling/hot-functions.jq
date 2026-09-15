# Self time per JavaScript function from the CPU samples of an `agent-browser profiler stop` file (#2228).
def frame: "\(.functionName | if . == "" then "(anonymous)" else . end) \((.url // "") | split("/") | last):\(.lineNumber)";
[.traceEvents[] | select(.name == "ProfileChunk")] as $chunks
| ([$chunks[] | .id as $profile | .args.data.cpuProfile.nodes // [] | .[]
    | {key: "\($profile):\(.id)", value: (.callFrame | frame)}] | from_entries) as $labels
| [$chunks[] | .id as $profile | .args.data as $data
    | ($data.cpuProfile.samples // []) as $samples | ($data.timeDeltas // []) as $deltas
    | range(0; $samples | length) | {function: $labels["\($profile):\($samples[.])"], micros: $deltas[.]}]
| map(select(.function | test("^\\((idle|program|garbage collector)\\)") | not))
| group_by(.function) | map({function: .[0].function, milliseconds: (map(.micros) | add / 1000 | round)})
| sort_by(-.milliseconds) | .[0:15][] | "\(.milliseconds)ms\t\(.function)"
