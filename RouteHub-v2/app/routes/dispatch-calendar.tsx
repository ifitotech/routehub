'use client'

import {ChevronLeft, ChevronRight} from 'lucide-react'
import {useState} from 'react'
import styles from './dispatch-calendar.module.css'

type DispatchCalendarProps = {
  selectedDate: string
  onDateChange: (date: string) => void
  locale: string
  routeCounts?: Record<string, number>
}

function toSafeDate(value: string): Date {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

export default function DispatchCalendar({selectedDate, onDateChange, locale, routeCounts = {}}: DispatchCalendarProps) {
  const [weekStart, setWeekStart] = useState(() => {
    const date = toSafeDate(selectedDate)
    date.setDate(date.getDate() - date.getDay())
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

  const dateToString = (date: Date) => date.toISOString().slice(0, 10)
  const isToday = (date: Date) => dateToString(date) === new Date().toISOString().slice(0, 10)

  return (
    <div className={styles.calendar}>
      <button className={styles.navButton} onClick={handlePrevWeek} aria-label="Previous week">
        <ChevronLeft size={18}/>
      </button>

      <div className={styles.weekDays}>
        {days.map((day, idx) => {
          const dateStr = dateToString(day)
          const isSelected = dateStr === selectedDate
          const count = routeCounts[dateStr] || 0
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
              {count > 0 && <span className={styles.badge}>{count}</span>}
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
