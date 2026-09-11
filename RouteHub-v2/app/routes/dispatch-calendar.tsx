'use client'

import {ChevronLeft, ChevronRight} from 'lucide-react'
import {useEffect, useRef, useState} from 'react'
import styles from './dispatch-calendar.module.css'

// Each day pill needs ~92px to stay readable (label + number + badge), plus
// room for the two nav buttons. Wide monitors can fit well past the original
// fixed 9-day strip, so the count is derived from measured width instead of
// a constant - the same wide-screen waste the sidebar/board columns had.
const DAY_MIN_WIDTH = 92
function daysForWidth(width: number): number {
  const usable = width - 80
  const fit = Math.floor(usable / DAY_MIN_WIDTH)
  return Math.max(9, Math.min(21, fit % 2 === 0 ? fit - 1 : fit))
}

type DispatchCalendarProps = {
  selectedDate: string
  onDateChange: (date: string) => void
  locale: string
  routeCounts?: Record<string, number>
  /** Routes on that date still waiting to be done. Only these turn the
   *  badge red - a day whose work is finished stays neutral grey. */
  pendingCounts?: Record<string, number>
}

// Route dates are local 'YYYY-MM-DD' strings (see localSchedule in
// routes-model). new Date('2026-09-11') parses that as midnight UTC, which in
// any negative-offset timezone is the previous local day - so getDate() showed
// every date one behind. Noon local is offset-proof, and is how the rest of
// the workspace parses these strings.
function toLocalDate(value: string): Date {
  const parsed = new Date(`${value}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

// Local-calendar counterpart of toISOString().slice(0,10), which would convert
// to UTC first and shift the day back for the same reason.
function toDateString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export default function DispatchCalendar({selectedDate, onDateChange, locale, routeCounts = {}, pendingCounts = {}}: DispatchCalendarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dayCount, setDayCount] = useState(9)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width
      if (width) setDayCount(daysForWidth(width))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Centered on the selected date rather than pinned to Monday, so growing
  // dayCount on a wider screen adds days evenly on both sides instead of
  // just extending further into the future.
  const [weekStart, setWeekStart] = useState(() => {
    const date = toLocalDate(selectedDate)
    date.setDate(date.getDate() - Math.floor(9 / 2))
    return date
  })

  useEffect(() => {
    setWeekStart(() => {
      const date = toLocalDate(selectedDate)
      date.setDate(date.getDate() - Math.floor(dayCount / 2))
      return date
    })
    // Only re-center when dayCount changes (screen resize) or the selected
    // date jumps outside the visible strip - not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayCount])

  const days = Array.from({length: dayCount}, (_, i) => {
    const day = new Date(weekStart)
    day.setDate(day.getDate() + i)
    return day
  })

  // Indexed by getDay() (0=Sunday) and read off each date, rather than by
  // position in the strip - a fixed positional list is what previously let
  // the labels drift a day out of step with the dates they sat on.
  const dayNames = locale === 'es'
    ? ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
    : locale === 'fr'
      ? ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM']
      : ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  const handlePrevWeek = () => {
    const newStart = new Date(weekStart)
    newStart.setDate(newStart.getDate() - 7)
    setWeekStart(newStart)
  }

  const handleNextWeek = () => {
    const newStart = new Date(weekStart)
    newStart.setDate(newStart.getDate() + 7)
    setWeekStart(newStart)
  }

  const todayString = toDateString(new Date())
  const isToday = (date: Date) => toDateString(date) === todayString

  return (
    <div className={styles.calendar} ref={containerRef}>
      <button className={styles.navButton} onClick={handlePrevWeek} aria-label="Previous week">
        <ChevronLeft size={18}/>
      </button>

      <div className={styles.weekDays}>
        {days.map(day => {
          const dateStr = toDateString(day)
          const isSelected = dateStr === selectedDate
          const count = routeCounts[dateStr] || 0
          const pending = pendingCounts[dateStr] || 0
          const dayNum = day.getDate()
          const dayName = dayNames[day.getDay()]

          return (
            <button
              key={dateStr}
              className={`${styles.day} ${isSelected ? styles.selected : ''} ${isToday(day) ? styles.today : ''}`}
              onClick={() => onDateChange(dateStr)}
              aria-label={`${dayName} ${dayNum}${isSelected ? ', selected' : ''}`}
            >
              <span className={styles.dayLabel}>
                <span className={styles.dayName}>{dayName}</span>
                <span className={styles.dayNum}>{dayNum}</span>
              </span>
              {count > 0 && <span className={styles.badge} data-tone={pending > 0 ? 'pending' : 'done'}>{count}</span>}
            </button>
          )
        })}
      </div>

      <button className={styles.navButton} onClick={handleNextWeek} aria-label="Next week">
        <ChevronRight size={18}/>
      </button>
    </div>
  )
}
