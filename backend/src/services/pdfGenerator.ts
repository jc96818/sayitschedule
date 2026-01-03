import PDFDocument from 'pdfkit'
import type { ScheduleWithSessions } from '../repositories/schedules.js'
import type { Organization } from '../repositories/organizations.js'
import { formatLocalDate, addDaysToLocalDate } from '../utils/timezone.js'

/**
 * Fetch an image from a URL and return it as a buffer
 */
async function fetchImageAsBuffer(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`Failed to fetch logo image: ${response.status}`)
      return null
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (err) {
    console.warn('Failed to fetch logo image:', err)
    return null
  }
}

interface PdfGeneratorOptions {
  schedule: ScheduleWithSessions
  organization: Organization
  timezone?: string
}

interface SessionData {
  time: string
  therapistName: string
  patientName: string
  roomName?: string
}

interface DayColumn {
  shortName: string
  dateStr: string
  sessions: Map<string, SessionData[]> // keyed by time slot
}

// Standard time slots for the schedule grid
const TIME_SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00']
const TIME_LABELS = ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM']

// Colors
const COLORS = {
  primary: [37, 99, 235] as [number, number, number],      // #2563eb - blue
  success: [16, 185, 129] as [number, number, number],     // #10b981 - green
  text: [30, 41, 59] as [number, number, number],          // #1e293b
  textSecondary: [100, 116, 139] as [number, number, number], // #64748b
  border: [226, 232, 240] as [number, number, number],     // #e2e8f0
  headerBg: [248, 250, 252] as [number, number, number],   // #f8fafc
  sessionBg: [250, 250, 250] as [number, number, number],  // #fafafa
}

// Format time from 24h to 12h format
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':')
  const hour = parseInt(hours, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${minutes} ${ampm}`
}

// Format date for display
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Format short date (e.g., "Dec 30")
function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Build day columns with sessions organized by time slot
function buildDayColumns(schedule: ScheduleWithSessions, timezone: string = 'UTC'): DayColumn[] {
  const weekStart = new Date(schedule.weekStartDate)
  const weekStartStr = formatLocalDate(weekStart, timezone)
  const columns: DayColumn[] = []
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

  for (let i = 0; i < 5; i++) {
    const dateKey = addDaysToLocalDate(weekStartStr, i, timezone)
    // Parse the date string for display formatting
    const [year, month, day] = dateKey.split('-').map(Number)
    const displayDate = new Date(year, month - 1, day)

    const sessionsMap = new Map<string, SessionData[]>()
    TIME_SLOTS.forEach(slot => sessionsMap.set(slot, []))

    // Find sessions for this day
    for (const session of schedule.sessions) {
      const sessionDateObj = session.date instanceof Date ? session.date : new Date(session.date)
      const sessionDate = formatLocalDate(sessionDateObj, timezone)
      if (sessionDate === dateKey) {
        const timeSlot = session.startTime?.slice(0, 5) || '09:00'
        const sessions = sessionsMap.get(timeSlot) || []
        sessions.push({
          time: formatTime(timeSlot),
          therapistName: session.therapistName || 'Unknown',
          patientName: session.patientName || 'Unknown',
          roomName: session.roomName
        })
        sessionsMap.set(timeSlot, sessions)
      }
    }

    columns.push({
      shortName: dayNames[i],
      dateStr: formatShortDate(displayDate),
      sessions: sessionsMap
    })
  }

  return columns
}

export async function generateSchedulePdf(options: PdfGeneratorOptions): Promise<Buffer> {
  const { schedule, organization, timezone = 'UTC' } = options

  // Calculate week date range using timezone-aware handling
  const weekStart = new Date(schedule.weekStartDate)
  const weekStartStr = formatLocalDate(weekStart, timezone)
  const weekEndStr = addDaysToLocalDate(weekStartStr, 4, timezone) // Friday

  // Parse dates for display
  const [startYear, startMonth, startDay] = weekStartStr.split('-').map(Number)
  const [endYear, endMonth, endDay] = weekEndStr.split('-').map(Number)
  const weekStartDisplay = new Date(startYear, startMonth - 1, startDay)
  const weekEndDisplay = new Date(endYear, endMonth - 1, endDay)

  // Build day columns with timezone
  const dayColumns = buildDayColumns(schedule, timezone)

  // Calculate stats
  const totalSessions = schedule.sessions.length
  const uniqueTherapists = new Set(schedule.sessions.map(s => s.therapistId)).size
  const uniquePatients = new Set(schedule.sessions.map(s => s.patientId)).size

  // Fetch grayscale logo if available (for print-friendly output)
  let logoBuffer: Buffer | null = null
  const logoUrl = organization.logoUrlGrayscale || organization.logoUrl
  if (logoUrl) {
    logoBuffer = await fetchImageAsBuffer(logoUrl)
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    // Landscape orientation for better table fit
    const doc = new PDFDocument({
      size: 'LETTER',
      layout: 'landscape',
      margins: { top: 30, bottom: 30, left: 40, right: 40 },
      info: {
        Title: `Schedule - ${formatDate(weekStartDisplay)} to ${formatDate(weekEndDisplay)}`,
        Author: organization.name,
        Subject: 'Weekly Schedule',
        Creator: 'Say It Schedule'
      }
    })

    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageWidth = doc.page.width - 80 // Account for margins
    const pageHeight = doc.page.height - 60

    // Layout calculations
    const timeColWidth = 55
    const dayColWidth = (pageWidth - timeColWidth) / 5
    const headerHeight = 50
    const tableHeaderHeight = 35
    const rowHeight = (pageHeight - headerHeight - tableHeaderHeight - 50) / TIME_SLOTS.length // 50 for footer

    let y = 30

    // === HEADER ===
    // Logo and organization name (left)
    const logoSize = 36
    let textStartX = 40

    if (logoBuffer) {
      try {
        doc.image(logoBuffer, 40, y, {
          width: logoSize,
          height: logoSize,
          fit: [logoSize, logoSize]
        })
        textStartX = 40 + logoSize + 10 // Logo width + padding
      } catch (err) {
        console.warn('Failed to embed logo in PDF:', err)
      }
    }

    // Organization name
    doc.fillColor(COLORS.text)
      .fontSize(16)
      .font('Helvetica-Bold')
      .text(organization.name, textStartX, y + 2)

    // Schedule subtitle
    doc.fillColor(COLORS.textSecondary)
      .fontSize(10)
      .font('Helvetica')
      .text(`Weekly Schedule: ${formatDate(weekStartDisplay)} - ${formatDate(weekEndDisplay)}`, textStartX, y + 20)

    // Status badge (right side)
    const statusText = schedule.status === 'published' ? 'Published' : 'Draft'
    const statusColor = schedule.status === 'published' ? COLORS.success : [245, 158, 11] as [number, number, number]
    const statusX = pageWidth + 40 - 60

    // Draw status badge border
    doc.roundedRect(statusX, y + 5, 55, 18, 9)
      .strokeColor(statusColor)
      .lineWidth(1)
      .stroke()

    doc.fillColor(statusColor)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text(statusText.toUpperCase(), statusX, y + 10, { width: 55, align: 'center' })

    // Version if > 1
    if (schedule.version > 1) {
      doc.fillColor(COLORS.textSecondary)
        .fontSize(8)
        .font('Helvetica')
        .text(`v${schedule.version}`, statusX, y + 26, { width: 55, align: 'center' })
    }

    // Header underline (brand color accent)
    y += headerHeight
    doc.strokeColor(COLORS.primary)
      .lineWidth(2)
      .moveTo(40, y)
      .lineTo(40 + pageWidth, y)
      .stroke()

    y += 8

    // === TABLE HEADER ===
    const tableStartX = 40
    const tableStartY = y

    // Draw header background
    doc.rect(tableStartX, tableStartY, pageWidth, tableHeaderHeight)
      .fillColor(COLORS.headerBg)
      .fill()

    // Time column header
    doc.fillColor(COLORS.textSecondary)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('Time', tableStartX + 5, tableStartY + 12)

    // Day column headers
    for (let i = 0; i < 5; i++) {
      const x = tableStartX + timeColWidth + (i * dayColWidth)
      const col = dayColumns[i]

      doc.fillColor(COLORS.text)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(col.shortName, x + 5, tableStartY + 8)

      doc.fillColor(COLORS.textSecondary)
        .fontSize(8)
        .font('Helvetica')
        .text(col.dateStr, x + 5, tableStartY + 20)
    }

    // Draw header borders
    doc.strokeColor(COLORS.border).lineWidth(1)
    doc.moveTo(tableStartX, tableStartY + tableHeaderHeight)
      .lineTo(tableStartX + pageWidth, tableStartY + tableHeaderHeight)
      .stroke()

    y = tableStartY + tableHeaderHeight

    // === TABLE ROWS ===
    for (let rowIdx = 0; rowIdx < TIME_SLOTS.length; rowIdx++) {
      const timeSlot = TIME_SLOTS[rowIdx]
      const timeLabel = TIME_LABELS[rowIdx]
      const rowY = y + (rowIdx * rowHeight)

      // Time cell background
      doc.rect(tableStartX, rowY, timeColWidth, rowHeight)
        .fillColor(COLORS.headerBg)
        .fill()

      // Time label
      doc.fillColor(COLORS.textSecondary)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(timeLabel, tableStartX + 5, rowY + (rowHeight / 2) - 5)

      // Day cells
      for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
        const cellX = tableStartX + timeColWidth + (dayIdx * dayColWidth)
        const col = dayColumns[dayIdx]
        const sessions = col.sessions.get(timeSlot) || []

        // Cell border
        doc.strokeColor(COLORS.border)
          .lineWidth(0.5)
          .rect(cellX, rowY, dayColWidth, rowHeight)
          .stroke()

        // Draw sessions
        let sessionY = rowY + 3
        for (const session of sessions) {
          const cardHeight = session.roomName ? 30 : 22
          if (sessionY + cardHeight + 2 > rowY + rowHeight - 2) break // Prevent overflow

          // Session card with light border
          const cardX = cellX + 3
          const cardWidth = dayColWidth - 6

          // Background with border
          doc.rect(cardX, sessionY, cardWidth, cardHeight)
            .fillColor(COLORS.sessionBg)
            .fill()
          doc.rect(cardX, sessionY, cardWidth, cardHeight)
            .strokeColor(COLORS.border)
            .lineWidth(0.5)
            .stroke()

          // Therapist name
          doc.fillColor(COLORS.text)
            .fontSize(7)
            .font('Helvetica-Bold')
            .text(session.therapistName, cardX + 4, sessionY + 3, {
              width: cardWidth - 6,
              lineBreak: false,
              ellipsis: true
            })

          // Patient name
          doc.fillColor(COLORS.textSecondary)
            .fontSize(6)
            .font('Helvetica')
            .text(session.patientName, cardX + 4, sessionY + 12, {
              width: cardWidth - 6,
              lineBreak: false,
              ellipsis: true
            })

          // Room name (if assigned)
          if (session.roomName) {
            doc.fillColor(COLORS.textSecondary)
              .fontSize(5)
              .font('Helvetica-Oblique')
              .text(session.roomName, cardX + 4, sessionY + 21, {
                width: cardWidth - 6,
                lineBreak: false,
                ellipsis: true
              })
          }

          sessionY += cardHeight + 2
        }
      }

      // Row bottom border
      doc.strokeColor(COLORS.border)
        .lineWidth(0.5)
        .moveTo(tableStartX, rowY + rowHeight)
        .lineTo(tableStartX + pageWidth, rowY + rowHeight)
        .stroke()
    }

    // === FOOTER ===
    const footerY = pageHeight + 15

    // Stats (left)
    doc.fillColor(COLORS.textSecondary)
      .fontSize(8)
      .font('Helvetica')
      .text(`Sessions: ${totalSessions}  |  Therapists: ${uniqueTherapists}  |  Patients: ${uniquePatients}`, 40, footerY)

    // Generated date (right)
    const now = new Date()
    doc.text(
      `Generated ${formatDate(now)}`,
      40,
      footerY,
      { width: pageWidth, align: 'right' }
    )

    doc.end()
  })
}
