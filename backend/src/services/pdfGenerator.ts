import PDFDocument from 'pdfkit'
import type { ScheduleWithSessions } from '../repositories/schedules.js'
import type { Organization } from '../repositories/organizations.js'

interface PdfGeneratorOptions {
  schedule: ScheduleWithSessions
  organization: Organization
}

interface SessionsByDay {
  [date: string]: {
    dayName: string
    dateStr: string
    sessions: Array<{
      time: string
      therapistName: string
      patientName: string
      notes?: string
    }>
  }
}

// Convert hex color to RGB for PDFKit
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ]
  }
  return [37, 99, 235] // Default to blue if parsing fails
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

// Get day name from date
function getDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

// Format short date (e.g., "Dec 30")
function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Group sessions by day
function groupSessionsByDay(sessions: ScheduleWithSessions['sessions']): SessionsByDay {
  const grouped: SessionsByDay = {}

  for (const session of sessions) {
    const date = new Date(session.date)
    const dateKey = date.toISOString().split('T')[0]

    if (!grouped[dateKey]) {
      grouped[dateKey] = {
        dayName: getDayName(date),
        dateStr: formatShortDate(date),
        sessions: []
      }
    }

    grouped[dateKey].sessions.push({
      time: formatTime(session.startTime || '09:00'),
      therapistName: session.therapistName || 'Unknown Therapist',
      patientName: session.patientName || 'Unknown Patient',
      notes: session.notes || undefined
    })
  }

  // Sort sessions within each day by time
  for (const dateKey of Object.keys(grouped)) {
    grouped[dateKey].sessions.sort((a, b) => a.time.localeCompare(b.time))
  }

  return grouped
}

// Fetch and convert logo to buffer (if URL provided)
async function fetchLogo(logoUrl: string): Promise<Buffer | null> {
  try {
    const response = await fetch(logoUrl)
    if (!response.ok) return null

    const contentType = response.headers.get('content-type')
    if (!contentType?.startsWith('image/')) return null

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch {
    return null
  }
}

export async function generateSchedulePdf(options: PdfGeneratorOptions): Promise<Buffer> {
  const { schedule, organization } = options

  const primaryColor = hexToRgb(organization.primaryColor || '#2563eb')
  const secondaryColor = hexToRgb(organization.secondaryColor || '#1e40af')

  // Calculate week date range
  const weekStart = new Date(schedule.weekStartDate)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 4) // Friday

  // Group sessions by day
  const sessionsByDay = groupSessionsByDay(schedule.sessions)
  const sortedDates = Object.keys(sessionsByDay).sort()

  // Calculate stats
  const totalSessions = schedule.sessions.length
  const uniqueTherapists = new Set(schedule.sessions.map(s => s.therapistId)).size
  const uniquePatients = new Set(schedule.sessions.map(s => s.patientId)).size

  // Fetch logo if available
  let logoBuffer: Buffer | null = null
  if (organization.logoUrl) {
    logoBuffer = await fetchLogo(organization.logoUrl)
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 50,
      info: {
        Title: `Schedule - ${formatDate(weekStart)} to ${formatDate(weekEnd)}`,
        Author: organization.name,
        Subject: 'Weekly Schedule',
        Creator: 'Say It Schedule'
      }
    })

    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageWidth = doc.page.width - 100 // Account for margins
    let yPosition = 50

    // === HEADER SECTION ===

    // Draw header background
    doc.rect(50, yPosition, pageWidth, 80)
      .fill(primaryColor)

    // Add logo or organization name
    const headerTextX = 70
    const headerTextY = yPosition + 15

    if (logoBuffer) {
      try {
        doc.image(logoBuffer, 60, yPosition + 10, { height: 60 })
        // Organization name next to logo
        doc.fillColor('white')
          .fontSize(20)
          .font('Helvetica-Bold')
          .text(organization.name, 130, headerTextY)
      } catch {
        // If logo fails, fall back to text only
        doc.fillColor('white')
          .fontSize(24)
          .font('Helvetica-Bold')
          .text(organization.name, headerTextX, headerTextY)
      }
    } else {
      doc.fillColor('white')
        .fontSize(24)
        .font('Helvetica-Bold')
        .text(organization.name, headerTextX, headerTextY)
    }

    // Subtitle with date range
    doc.fillColor('white')
      .fontSize(12)
      .font('Helvetica')
      .text(`Weekly Schedule: ${formatDate(weekStart)} - ${formatDate(weekEnd)}`, headerTextX, headerTextY + 30)

    // Status badge
    const statusText = schedule.status === 'published' ? 'Published' : 'Draft'
    const statusBadgeX = pageWidth - 30
    doc.fillColor('white')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(statusText, statusBadgeX, headerTextY + 32, { align: 'right', width: 80 })

    yPosition += 100

    // === SESSIONS BY DAY ===

    if (sortedDates.length === 0) {
      doc.fillColor('#666666')
        .fontSize(14)
        .font('Helvetica')
        .text('No sessions scheduled for this week.', 50, yPosition, { align: 'center', width: pageWidth })
    } else {
      for (const dateKey of sortedDates) {
        const dayData = sessionsByDay[dateKey]

        // Check if we need a new page
        const estimatedHeight = 30 + (dayData.sessions.length * 25)
        if (yPosition + estimatedHeight > doc.page.height - 100) {
          doc.addPage()
          yPosition = 50
        }

        // Day header
        doc.rect(50, yPosition, pageWidth, 25)
          .fill(secondaryColor)

        doc.fillColor('white')
          .fontSize(12)
          .font('Helvetica-Bold')
          .text(`${dayData.dayName.toUpperCase()} - ${dayData.dateStr}`, 60, yPosition + 7)

        yPosition += 35

        // Sessions for this day
        for (const session of dayData.sessions) {
          // Time column
          doc.fillColor('#333333')
            .fontSize(11)
            .font('Helvetica-Bold')
            .text(session.time, 60, yPosition, { width: 80 })

          // Therapist → Patient
          doc.fillColor('#333333')
            .fontSize(11)
            .font('Helvetica')
            .text(`${session.therapistName}  →  ${session.patientName}`, 150, yPosition, { width: pageWidth - 150 })

          yPosition += 20

          // Notes (if present)
          if (session.notes) {
            doc.fillColor('#666666')
              .fontSize(9)
              .font('Helvetica-Oblique')
              .text(`Note: ${session.notes}`, 150, yPosition, { width: pageWidth - 150 })
            yPosition += 15
          }
        }

        yPosition += 15 // Space between days
      }
    }

    // === FOOTER SECTION ===

    // Ensure footer is at the bottom
    const footerY = doc.page.height - 80

    // Draw footer line
    doc.strokeColor(primaryColor)
      .lineWidth(1)
      .moveTo(50, footerY)
      .lineTo(50 + pageWidth, footerY)
      .stroke()

    // Stats
    doc.fillColor('#666666')
      .fontSize(10)
      .font('Helvetica')
      .text(
        `Total Sessions: ${totalSessions}  |  Therapists: ${uniqueTherapists}  |  Patients: ${uniquePatients}`,
        50,
        footerY + 15,
        { align: 'center', width: pageWidth }
      )

    // Generation timestamp
    const now = new Date()
    doc.text(
      `Generated on ${formatDate(now)} at ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`,
      50,
      footerY + 30,
      { align: 'center', width: pageWidth }
    )

    // Version info if published
    if (schedule.version > 1) {
      doc.text(
        `Version ${schedule.version}`,
        50,
        footerY + 45,
        { align: 'center', width: pageWidth }
      )
    }

    doc.end()
  })
}
