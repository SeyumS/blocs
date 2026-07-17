import { addMinutes, format, startOfDay } from 'date-fns'

export const generateTimeSlots = (start: string, end: string, interval: number) => {
  const slots = []
  let currentTime = start
  while (currentTime < end) {
    slots.push(format(new Date(currentTime), 'HH:mm'))
    currentTime = addMinutes(new Date(currentTime), interval).toISOString()
  }
  return slots
}