type Subscription = { unsubscribe: () => void }

// Opens a subscription and opens it again a second after each loss, until stopped. `open` calls
// `lost` from its error handler; `lost` answers whether the subscription is still wanted.
export function reconnectingSubscription(open: (lost: () => boolean) => Subscription) {
  let stopped = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let subscription: Subscription | null = null
  const lost = () => {
    if (stopped) return false
    timer = setTimeout(reconnect, 1000)
    return true
  }
  const reconnect = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    subscription?.unsubscribe()
    subscription = open(lost)
  }
  reconnect()
  return {
    reconnect,
    stop() {
      stopped = true
      subscription?.unsubscribe()
      if (timer !== null) clearTimeout(timer)
    },
  }
}
