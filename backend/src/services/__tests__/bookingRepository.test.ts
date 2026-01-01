import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

const mockPrisma = {
  $transaction: vi.fn()
}

vi.mock('../../repositories/base.js', () => ({
  prisma: mockPrisma
}))

vi.mock('../availability.js', () => ({
  availabilityService: {
    isSlotAvailable: vi.fn(),
    getAvailableSlots: vi.fn()
  }
}))

vi.mock('../../repositories/organizationSettings.js', () => ({
  organizationSettingsRepository: {
    findByOrganizationId: vi.fn().mockResolvedValue({
      timezone: 'America/New_York',
      defaultSessionDuration: 60,
      slotInterval: 30,
      lateCancelWindowHours: 24,
      businessHours: {}
    })
  }
}))

// Helper type for mock transaction client
interface MockTxClient {
  appointmentHold: {
    findFirst: Mock
    update?: Mock
  }
  session: {
    findFirst: Mock
    create?: Mock
  }
  schedule?: {
    findFirst: Mock
    create: Mock
  }
  user?: {
    findFirst: Mock
  }
}

describe('BookingRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects booking from hold when a conflicting session exists', async () => {
    const { BookingRepository } = await import('../../repositories/booking.js')
    const repo = new BookingRepository()

    const tx: MockTxClient = {
      appointmentHold: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'hold-1',
          organizationId: 'org-1',
          staffId: 'staff-1',
          roomId: null,
          date: new Date('2025-01-01'),
          startTime: '10:00',
          endTime: '11:00',
          expiresAt: new Date(Date.now() + 60_000),
          releasedAt: null,
          convertedToSessionId: null,
          createdByContactId: 'contact-1',
          createdByUserId: null
        })
      },
      session: {
        findFirst: vi.fn().mockResolvedValue({ id: 'session-conflict' })
      }
    }

    mockPrisma.$transaction.mockImplementationOnce(async (fn: (txArg: unknown) => Promise<unknown>) => {
      return fn(tx)
    })

    const result = await repo.bookFromHold({
      holdId: 'hold-1',
      organizationId: 'org-1',
      patientId: 'patient-1',
      bookedVia: 'portal',
      bookedByContactId: 'contact-1'
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Time slot is no longer available')
    expect(tx.appointmentHold.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'hold-1', organizationId: 'org-1' })
    }))
    expect(tx.session.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        schedule: { organizationId: 'org-1' }
      })
    }))
  })

  it('books from hold when slot is still available', async () => {
    const { BookingRepository } = await import('../../repositories/booking.js')
    const repo = new BookingRepository()

    const tx: MockTxClient = {
      appointmentHold: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'hold-1',
          organizationId: 'org-1',
          staffId: 'staff-1',
          roomId: null,
          date: new Date('2025-01-01'),
          startTime: '10:00',
          endTime: '11:00',
          expiresAt: new Date(Date.now() + 60_000),
          releasedAt: null,
          convertedToSessionId: null,
          createdByContactId: 'contact-1',
          createdByUserId: null
        }),
        update: vi.fn().mockResolvedValue(true)
      },
      session: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'session-1' })
      },
      schedule: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'schedule-1' })
      },
      user: {
        findFirst: vi.fn().mockResolvedValue({ id: 'user-1' })
      }
    }

    mockPrisma.$transaction.mockImplementationOnce(async (fn: (txArg: unknown) => Promise<unknown>) => {
      return fn(tx)
    })

    const result = await repo.bookFromHold({
      holdId: 'hold-1',
      organizationId: 'org-1',
      patientId: 'patient-1',
      bookedVia: 'portal',
      bookedByContactId: 'contact-1'
    })

    expect(result.success).toBe(true)
    expect(result.sessionId).toBe('session-1')
    expect(tx.session.create).toHaveBeenCalled()
    expect(tx.appointmentHold.update).toHaveBeenCalledWith({
      where: { id: 'hold-1' },
      data: { convertedToSessionId: 'session-1' }
    })
  })
})

