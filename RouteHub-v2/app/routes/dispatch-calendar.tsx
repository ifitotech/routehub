'use client'

import {ChevronLeft, ChevronRight} from 'lucide-react'
import {useState} from 'react'
import styles from './dispatch-calendar.module.css'

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
  const [weekStart, setWeekStart] = useState(() => {
    const date = toLocalDate(selectedDate)
    // The labels below run Monday-first, so the week has to start on Monday
    // too. getDay() is Sunday-based (0=Sun), which was shifting every label
    // one day off its date.
    const offsetToMonday = (date.getDay() + 6) % 7
    date.setDate(date.getDate() - offsetToMonday)
    return date
  })

  const days = Array.from({length: 7}, (_, i) => {
    const day = new Date(weekStart)
    day.setDate(day.getDate() + i)
    return day
  })

  const dayNames = locale === 'es' ? ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'] : locale === 'fr' ? ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'] : ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

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
    <div className={styles.calendar}>
      <button className={styles.navButton} onClick={handlePrevWeek} aria-label="Previous week">
        <ChevronLeft size={18}/>
      </button>

      <div className={styles.weekDays}>
        {days.map((day, idx) => {
          const dateStr = toDateString(day)
          const isSelected = dateStr === selectedDate
          const count = routeCounts[dateStr] || 0
          const pending = pendingCounts[dateStr] || 0
          const dayNum = day.getDate()

          return (
            <button
              key={dateStr}
              className={`${styles.day} ${isSelected ? styles.selected : ''} ${isToday(day) ? styles.today : ''}`}
              onClick={() => onDateChange(dateStr)}
              aria-label={`${dayNames[idx]} ${dayNum}${isSelected ? ', selected' : ''}`}
            >
              <span className={styles.dayName}>{dayNames[idx]}</span>
              <span className={styles.dayNum}>{dayNum}</span>
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
