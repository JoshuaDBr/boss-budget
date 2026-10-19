import { useEffect, useState } from 'react'
import { countdownText, newestTime, remaining, type FeedState } from '../prices/feed'

interface Props {
  feed: FeedState
  onRefresh: () => void
}

/**
 * The refresh button. While the launch queue or a refresh is running, a countdown replaces the icon and the button
 * cannot be clicked. The label under it shows the time of the newest price.
 */
export default function Refresh({ feed, onRefresh }: Props) {
  const now = useNow(feed.running)
  const time = newestTime(feed.prices)
  return (
    <section id="refresh" className="comp">
      <button
        id="refreshBtn"
        type="button"
        aria-label={feed.running ? 'Prices are refreshing' : 'Refresh prices'}
        aria-disabled={feed.running || undefined}
        onClick={() => !feed.running && onRefresh()}
      >
        {feed.running ? (
          <span className="countdown" role="timer">{countdownText(remaining(feed, now))}</span>
        ) : (
          <svg viewBox="0 0 60 60" aria-hidden="true">
            <path d="M30 8 C16 8 8 19 9 31 C10 44 20 52 31 51 C43 50 51 41 51 30 C51 22 47 16 41 12" fill="none" stroke="#333" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M33 13 L42 11 L40 20" fill="none" stroke="#333" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" transform="rotate(8 40 14)" />
          </svg>
        )}
      </button>
      <div id="updated">prices: {time ?? '-:--'}</div>
    </section>
  )
}

/** The current time, updated a few times a second while `ticking`. */
function useNow(ticking: boolean) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    setNow(Date.now())
    if (!ticking) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [ticking])
  return now
}

/** "Price could not refresh. Try again shortly." Small, centered, gone after 3 seconds. Shown once per failure. */
export function FailedPopup({ failures }: { failures: number }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (!failures) return
    setShown(failures)
    const id = setTimeout(() => setShown(0), 3000)
    return () => clearTimeout(id)
  }, [failures])
  if (!shown) return null
  return (
    <div id="offline" className="comp box" role="status">
      Price could not refresh. Try again shortly.
    </div>
  )
}
