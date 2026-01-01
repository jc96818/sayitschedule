import { describe, it, expect, vi, beforeEach } from 'vitest'

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

describe('BookingRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects booking from hold when a conflicting session exists', async () => {
    const { BookingRepository } = await import('../../repositories/booking.js')
    const repo = new BookingRepository()

    const tx = {
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
    } as unknown as Parameters<Parameters<typeof mockPrisma.$transaction>[0]>[0]

    mockPrisma.$transaction.mockImplementationOnce(async (fn: (txArg: typeof tx) => Promise<unknown>) => {
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
    expect((tx.appointmentHold.findFirst as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'hold-1', organizationId: 'org-1' })
    }))
    expect((tx.session.findFirst as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        schedule: { organizationId: 'org-1' }
      })
    }))
  })

  it('books from hold when slot is still available', async () => {
    const { BookingRepository } = await import('../../repositories/booking.js')
    const repo = new BookingRepository()

    const tx = {
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
    } as unknown as Parameters<Parameters<typeof mockPrisma.$transaction>[0]>[0]

    mockPrisma.$transaction.mockImplementationOnce(async (fn: (txArg: typeof tx) => Promise<unknown>) => {
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
    expect((tx.session.create as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalled()
    expect((tx.appointmentHold.update as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({
      where: { id: 'hold-1' },
      data: { convertedToSessionId: 'session-1' }
    })
  })
})

