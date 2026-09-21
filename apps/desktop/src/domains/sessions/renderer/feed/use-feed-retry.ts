import { useCallback, useState } from 'react'

export function useFeedRetry(onRetryFeed: () => void) {
  const [retryToken, setRetryToken] = useState(0)
  const retry = useCallback(() => {
    setRetryToken((token) => token + 1)
    onRetryFeed()
  }, [onRetryFeed])
  return { retry, retryToken }
}
