"use client"

import { useState, useEffect } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getBookedDates, checkDateAvailability } from "@/lib/carbardmv-actions"
import { format, startOfMonth, endOfMonth, addMonths, isBefore, startOfDay, isSameDay } from "date-fns"
import { CalendarIcon, Clock, CheckCircle2, XCircle, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface AvailabilityCalendarProps {
  onDateSelect?: (date: Date | undefined) => void
  onTimeSelect?: (time: string) => void
  selectedDate?: Date
  selectedTime?: string
  className?: string
}

const TIME_SLOTS = [
  { value: "10:00", label: "10 AM", fullLabel: "10:00 AM" },
  { value: "12:00", label: "12 PM", fullLabel: "12:00 PM" },
  { value: "14:00", label: "2 PM", fullLabel: "2:00 PM" },
  { value: "16:00", label: "4 PM", fullLabel: "4:00 PM" },
  { value: "18:00", label: "6 PM", fullLabel: "6:00 PM" },
  { value: "20:00", label: "8 PM", fullLabel: "8:00 PM" },
]

export function AvailabilityCalendar({
  onDateSelect,
  onTimeSelect,
  selectedDate,
  selectedTime,
  className,
}: AvailabilityCalendarProps) {
  const [month, setMonth] = useState(new Date())
  const [bookedDates, setBookedDates] = useState<string[]>([])
  const [partialDates, setPartialDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [availableTimes, setAvailableTimes] = useState<string[]>(TIME_SLOTS.map(t => t.value))
  const [checkingTime, setCheckingTime] = useState(false)

  // Fetch booked dates for current month view
  useEffect(() => {
    async function fetchAvailability() {
      setLoading(true)
      const start = format(startOfMonth(month), "yyyy-MM-dd")
      const end = format(endOfMonth(addMonths(month, 1)), "yyyy-MM-dd")
      
      const result = await getBookedDates(start, end)
      setBookedDates(result.bookedDates)
      setPartialDates(result.partialDates)
      setLoading(false)
    }
    fetchAvailability()
  }, [month])

  // Check time availability when date is selected
  useEffect(() => {
    async function checkTimes() {
      if (!selectedDate) {
        setAvailableTimes(TIME_SLOTS.map(t => t.value))
        return
      }
      
      setCheckingTime(true)
      const dateStr = format(selectedDate, "yyyy-MM-dd")
      const result = await checkDateAvailability(dateStr)
      
      if (result.suggestedTimes) {
        setAvailableTimes(result.suggestedTimes)
      } else {
        setAvailableTimes(TIME_SLOTS.map(t => t.value))
      }
      setCheckingTime(false)
    }
    checkTimes()
  }, [selectedDate])

  const handleDateSelect = (date: Date | undefined) => {
    if (date && isDateDisabled(date)) return
    onDateSelect?.(date)
  }

  const isDateDisabled = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd")
    const today = startOfDay(new Date())
    
    // Can't book past dates
    if (isBefore(date, today)) return true
    
    // Can't book fully booked dates
    if (bookedDates.includes(dateStr)) return true
    
    return false
  }

  const getDateStatus = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd")
    
    if (bookedDates.includes(dateStr)) return "booked"
    if (partialDates.includes(dateStr)) return "partial"
    return "available"
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Select Date & Time
            </CardTitle>
            <CardDescription>Choose your preferred event date</CardDescription>
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMonth(addMonths(month, -1))}
              disabled={isBefore(startOfMonth(month), startOfDay(new Date()))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMonth(addMonths(month, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <span>Limited</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <span>Booked</span>
          </div>
        </div>

        {/* Calendar */}
        {loading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            month={month}
            onMonthChange={setMonth}
            disabled={isDateDisabled}
            modifiers={{
              booked: (date) => bookedDates.includes(format(date, "yyyy-MM-dd")),
              partial: (date) => partialDates.includes(format(date, "yyyy-MM-dd")),
            }}
            modifiersClassNames={{
              booked: "bg-red-500/20 text-red-500 line-through",
              partial: "bg-yellow-500/20 text-yellow-700",
            }}
            className="rounded-md border"
          />
        )}

        {/* Selected Date Info */}
        {selectedDate && (
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{format(selectedDate, "EEEE, MMMM d, yyyy")}</p>
                <p className="text-sm text-muted-foreground">
                  {getDateStatus(selectedDate) === "partial" 
                    ? "Limited time slots available" 
                    : "All time slots available"}
                </p>
              </div>
              {getDateStatus(selectedDate) === "available" ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
            </div>
          </div>
        )}

        {/* Time Slots */}
        {selectedDate && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Select Time</span>
            </div>
            
            {checkingTime ? (
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {TIME_SLOTS.map((slot) => {
                  const isAvailable = availableTimes.includes(slot.value)
                  const isSelected = selectedTime === slot.value
                  
                  return (
                    <Button
                      key={slot.value}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      disabled={!isAvailable}
                      onClick={() => onTimeSelect?.(slot.value)}
                      className={cn(
                        "h-11 touch-manipulation text-sm sm:h-10",
                        !isAvailable && "opacity-50 line-through",
                        isSelected && "ring-2 ring-primary ring-offset-2"
                      )}
                    >
                      <span className="sm:hidden">{slot.label}</span>
                      <span className="hidden sm:inline">{slot.fullLabel}</span>
                    </Button>
                  )
                })}
              </div>
            )}
            
            {availableTimes.length < TIME_SLOTS.length && (
              <p className="text-xs text-muted-foreground">
                Some time slots are unavailable due to existing bookings
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Compact version for the booking wizard
export function CompactDatePicker({
  selectedDate,
  selectedTime,
  onDateSelect,
  onTimeSelect,
}: AvailabilityCalendarProps) {
  const [showCalendar, setShowCalendar] = useState(false)

  return (
    <div className="space-y-4">
      {/* Date Selection */}
      <div>
        <Button
          variant="outline"
          onClick={() => setShowCalendar(!showCalendar)}
          className="w-full justify-start text-left font-normal"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? format(selectedDate, "PPP") : "Select a date"}
        </Button>
      </div>

      {showCalendar && (
        <AvailabilityCalendar
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          onDateSelect={(date) => {
            onDateSelect?.(date)
            if (date) setShowCalendar(false)
          }}
          onTimeSelect={onTimeSelect}
        />
      )}

      {/* Quick Time Selection (after date is selected) */}
      {selectedDate && !showCalendar && (
        <div className="grid grid-cols-3 gap-2">
          {TIME_SLOTS.map((slot) => (
            <Button
              key={slot.value}
              variant={selectedTime === slot.value ? "default" : "outline"}
              size="sm"
              onClick={() => onTimeSelect?.(slot.value)}
            >
              {slot.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
