export function forwardProgress<Event>(
  parse: (text: string) => Event[],
  onEvent: ((event: Event) => void) | undefined,
): (text: string) => void {
  let announced = 0
  return (text) => {
    const events = parse(text)
    for (const event of events.slice(announced)) onEvent?.(event)
    announced = events.length
  }
}
