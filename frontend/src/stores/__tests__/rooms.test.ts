import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRoomsStore } from '../rooms'
import type { Room } from '@/types'
import { roomService } from '@/services/api'

// Mock the API services
vi.mock('@/services/api', () => ({
  roomService: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  }
}))

describe('Rooms Store', () => {
  const mockRooms: Room[] = [
    {
      id: 'room-1',
      organizationId: 'org-1',
      name: 'Therapy Room A',
      capabilities: ['sensory', 'quiet'],
      description: 'A quiet therapy room with sensory equipment',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'room-2',
      organizationId: 'org-1',
      name: 'Therapy Room B',
      capabilities: ['large', 'group'],
      description: 'Large room for group sessions',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 'room-3',
      organizationId: 'org-1',
      name: 'Storage Room',
      capabilities: [],
      description: null,
      status: 'inactive',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    }
  ]

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have empty rooms array', () => {
      const store = useRoomsStore()
      expect(store.rooms).toEqual([])
    })

    it('should have null currentRoom', () => {
      const store = useRoomsStore()
      expect(store.currentRoom).toBeNull()
    })

    it('should have loading set to false', () => {
      const store = useRoomsStore()
      expect(store.loading).toBe(false)
    })

    it('should have error set to null', () => {
      const store = useRoomsStore()
      expect(store.error).toBeNull()
    })

    it('should have totalCount set to 0', () => {
      const store = useRoomsStore()
      expect(store.totalCount).toBe(0)
    })
  })

  describe('fetchRooms', () => {
    it('should fetch and store rooms', async () => {
      vi.mocked(roomService.list).mockResolvedValue({
        data: mockRooms,
        total: 3,
        page: 1,
        limit: 50,
        totalPages: 1
      })

      const store = useRoomsStore()
      await store.fetchRooms()

      expect(store.rooms).toEqual(mockRooms)
      expect(store.totalCount).toBe(3)
    })

    it('should set loading to true while fetching', async () => {
      let resolvePromise: (value: unknown) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      vi.mocked(roomService.list).mockReturnValue(promise as never)

      const store = useRoomsStore()
      const fetchPromise = store.fetchRooms()

      expect(store.loading).toBe(true)

      resolvePromise!({
        data: mockRooms,
        total: 3,
        page: 1,
        limit: 50,
        totalPages: 1
      })
      await fetchPromise

      expect(store.loading).toBe(false)
    })

    it('should pass search params to service', async () => {
      vi.mocked(roomService.list).mockResolvedValue({
        data: [mockRooms[0]],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1
      })

      const store = useRoomsStore()
      await store.fetchRooms({ search: 'Therapy Room A' })

      expect(roomService.list).toHaveBeenCalledWith({ search: 'Therapy Room A' })
    })

    it('should pass status filter to service', async () => {
      vi.mocked(roomService.list).mockResolvedValue({
        data: mockRooms.filter(r => r.status === 'active'),
        total: 2,
        page: 1,
        limit: 50,
        totalPages: 1
      })

      const store = useRoomsStore()
      await store.fetchRooms({ status: 'active' })

      expect(roomService.list).toHaveBeenCalledWith({ status: 'active' })
    })

    it('should handle errors', async () => {
      vi.mocked(roomService.list).mockRejectedValue(new Error('Network error'))

      const store = useRoomsStore()

      await expect(store.fetchRooms()).rejects.toThrow('Network error')
      expect(store.error).toBe('Network error')
      expect(store.loading).toBe(false)
    })

    it('should handle non-Error exceptions', async () => {
      vi.mocked(roomService.list).mockRejectedValue('Unknown error')

      const store = useRoomsStore()

      await expect(store.fetchRooms()).rejects.toBe('Unknown error')
      expect(store.error).toBe('Failed to fetch rooms')
    })

    it('should clear error before fetching', async () => {
      vi.mocked(roomService.list).mockResolvedValue({
        data: mockRooms,
        total: 3,
        page: 1,
        limit: 50,
        totalPages: 1
      })

      const store = useRoomsStore()
      store.error = 'Previous error'

      await store.fetchRooms()

      expect(store.error).toBeNull()
    })
  })

  describe('fetchRoomById', () => {
    it('should fetch and set currentRoom', async () => {
      vi.mocked(roomService.get).mockResolvedValue({ data: mockRooms[0] })

      const store = useRoomsStore()
      const result = await store.fetchRoomById('room-1')

      expect(store.currentRoom).toEqual(mockRooms[0])
      expect(result).toEqual(mockRooms[0])
    })

    it('should set loading during fetch', async () => {
      let resolvePromise: (value: unknown) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      vi.mocked(roomService.get).mockReturnValue(promise as never)

      const store = useRoomsStore()
      const fetchPromise = store.fetchRoomById('room-1')

      expect(store.loading).toBe(true)

      resolvePromise!({ data: mockRooms[0] })
      await fetchPromise

      expect(store.loading).toBe(false)
    })

    it('should handle errors', async () => {
      vi.mocked(roomService.get).mockRejectedValue(new Error('Room not found'))

      const store = useRoomsStore()

      await expect(store.fetchRoomById('room-999')).rejects.toThrow('Room not found')
      expect(store.error).toBe('Room not found')
    })

    it('should handle non-Error exceptions', async () => {
      vi.mocked(roomService.get).mockRejectedValue('Not found')

      const store = useRoomsStore()

      await expect(store.fetchRoomById('room-999')).rejects.toBe('Not found')
      expect(store.error).toBe('Failed to fetch room')
    })
  })

  describe('createRoom', () => {
    const newRoom: Room = {
      id: 'room-4',
      organizationId: 'org-1',
      name: 'New Room',
      capabilities: ['wheelchair', 'accessible'],
      description: 'A wheelchair accessible room',
      status: 'active',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    }

    it('should create room and add to store', async () => {
      vi.mocked(roomService.create).mockResolvedValue({ data: newRoom })

      const store = useRoomsStore()
      store.rooms = [...mockRooms]
      store.totalCount = 3

      const result = await store.createRoom({
        name: 'New Room',
        capabilities: ['wheelchair', 'accessible']
      })

      expect(result).toEqual(newRoom)
      expect(store.rooms).toHaveLength(4)
      expect(store.rooms[3]).toEqual(newRoom)
      expect(store.totalCount).toBe(4)
    })

    it('should set loading during create', async () => {
      let resolvePromise: (value: unknown) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      vi.mocked(roomService.create).mockReturnValue(promise as never)

      const store = useRoomsStore()
      const createPromise = store.createRoom({ name: 'New Room' })

      expect(store.loading).toBe(true)

      resolvePromise!({ data: newRoom })
      await createPromise

      expect(store.loading).toBe(false)
    })

    it('should handle errors', async () => {
      vi.mocked(roomService.create).mockRejectedValue(new Error('Duplicate room name'))

      const store = useRoomsStore()

      await expect(store.createRoom({ name: 'Therapy Room A' })).rejects.toThrow('Duplicate room name')
      expect(store.error).toBe('Duplicate room name')
    })

    it('should handle non-Error exceptions', async () => {
      vi.mocked(roomService.create).mockRejectedValue('Validation failed')

      const store = useRoomsStore()

      await expect(store.createRoom({ name: '' })).rejects.toBe('Validation failed')
      expect(store.error).toBe('Failed to create room')
    })
  })

  describe('updateRoom', () => {
    const updatedRoom: Room = {
      ...mockRooms[0],
      name: 'Updated Room Name',
      capabilities: ['sensory', 'quiet', 'new-capability']
    }

    it('should update room in store', async () => {
      vi.mocked(roomService.update).mockResolvedValue({ data: updatedRoom })

      const store = useRoomsStore()
      store.rooms = [...mockRooms]

      const result = await store.updateRoom('room-1', { name: 'Updated Room Name' })

      expect(result).toEqual(updatedRoom)
      expect(store.rooms[0]).toEqual(updatedRoom)
    })

    it('should update currentRoom if it matches', async () => {
      vi.mocked(roomService.update).mockResolvedValue({ data: updatedRoom })

      const store = useRoomsStore()
      store.rooms = [...mockRooms]
      store.currentRoom = mockRooms[0]

      await store.updateRoom('room-1', { name: 'Updated Room Name' })

      expect(store.currentRoom).toEqual(updatedRoom)
    })

    it('should not update currentRoom if it does not match', async () => {
      vi.mocked(roomService.update).mockResolvedValue({ data: updatedRoom })

      const store = useRoomsStore()
      store.rooms = [...mockRooms]
      store.currentRoom = mockRooms[1] // Different room

      await store.updateRoom('room-1', { name: 'Updated Room Name' })

      expect(store.currentRoom).toEqual(mockRooms[1])
    })

    it('should set loading during update', async () => {
      let resolvePromise: (value: unknown) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      vi.mocked(roomService.update).mockReturnValue(promise as never)

      const store = useRoomsStore()
      store.rooms = [...mockRooms]
      const updatePromise = store.updateRoom('room-1', { name: 'Updated' })

      expect(store.loading).toBe(true)

      resolvePromise!({ data: updatedRoom })
      await updatePromise

      expect(store.loading).toBe(false)
    })

    it('should handle room not in store gracefully', async () => {
      vi.mocked(roomService.update).mockResolvedValue({ data: updatedRoom })

      const store = useRoomsStore()
      store.rooms = []

      await store.updateRoom('room-1', { name: 'Updated Room Name' })

      expect(store.rooms).toHaveLength(0)
    })

    it('should handle errors', async () => {
      vi.mocked(roomService.update).mockRejectedValue(new Error('Update failed'))

      const store = useRoomsStore()

      await expect(store.updateRoom('room-1', { name: 'Updated' })).rejects.toThrow('Update failed')
      expect(store.error).toBe('Update failed')
    })

    it('should handle non-Error exceptions', async () => {
      vi.mocked(roomService.update).mockRejectedValue('Server error')

      const store = useRoomsStore()

      await expect(store.updateRoom('room-1', { name: '' })).rejects.toBe('Server error')
      expect(store.error).toBe('Failed to update room')
    })
  })

  describe('deleteRoom', () => {
    it('should delete room from store', async () => {
      vi.mocked(roomService.delete).mockResolvedValue(undefined)

      const store = useRoomsStore()
      store.rooms = [...mockRooms]
      store.totalCount = 3

      await store.deleteRoom('room-1')

      expect(store.rooms).toHaveLength(2)
      expect(store.rooms.find(r => r.id === 'room-1')).toBeUndefined()
      expect(store.totalCount).toBe(2)
    })

    it('should clear currentRoom if it matches deleted room', async () => {
      vi.mocked(roomService.delete).mockResolvedValue(undefined)

      const store = useRoomsStore()
      store.rooms = [...mockRooms]
      store.currentRoom = mockRooms[0]
      store.totalCount = 3

      await store.deleteRoom('room-1')

      expect(store.currentRoom).toBeNull()
    })

    it('should not clear currentRoom if it does not match', async () => {
      vi.mocked(roomService.delete).mockResolvedValue(undefined)

      const store = useRoomsStore()
      store.rooms = [...mockRooms]
      store.currentRoom = mockRooms[1]
      store.totalCount = 3

      await store.deleteRoom('room-1')

      expect(store.currentRoom).toEqual(mockRooms[1])
    })

    it('should set loading during delete', async () => {
      let resolvePromise: (value: unknown) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      vi.mocked(roomService.delete).mockReturnValue(promise as never)

      const store = useRoomsStore()
      store.rooms = [...mockRooms]
      store.totalCount = 3
      const deletePromise = store.deleteRoom('room-1')

      expect(store.loading).toBe(true)

      resolvePromise!(undefined)
      await deletePromise

      expect(store.loading).toBe(false)
    })

    it('should handle errors', async () => {
      vi.mocked(roomService.delete).mockRejectedValue(new Error('Cannot delete room in use'))

      const store = useRoomsStore()

      await expect(store.deleteRoom('room-1')).rejects.toThrow('Cannot delete room in use')
      expect(store.error).toBe('Cannot delete room in use')
    })

    it('should handle non-Error exceptions', async () => {
      vi.mocked(roomService.delete).mockRejectedValue('Delete failed')

      const store = useRoomsStore()

      await expect(store.deleteRoom('room-1')).rejects.toBe('Delete failed')
      expect(store.error).toBe('Failed to delete room')
    })
  })

  describe('clearCurrent', () => {
    it('should clear currentRoom', () => {
      const store = useRoomsStore()
      store.currentRoom = mockRooms[0]

      store.clearCurrent()

      expect(store.currentRoom).toBeNull()
    })
  })

  describe('room capabilities', () => {
    it('should store rooms with various capabilities', async () => {
      vi.mocked(roomService.list).mockResolvedValue({
        data: mockRooms,
        total: 3,
        page: 1,
        limit: 50,
        totalPages: 1
      })

      const store = useRoomsStore()
      await store.fetchRooms()

      expect(store.rooms[0].capabilities).toEqual(['sensory', 'quiet'])
      expect(store.rooms[1].capabilities).toEqual(['large', 'group'])
      expect(store.rooms[2].capabilities).toEqual([])
    })

    it('should update room capabilities', async () => {
      const updatedRoom = {
        ...mockRooms[0],
        capabilities: ['sensory', 'quiet', 'wheelchair']
      }
      vi.mocked(roomService.update).mockResolvedValue({ data: updatedRoom })

      const store = useRoomsStore()
      store.rooms = [...mockRooms]

      await store.updateRoom('room-1', { capabilities: ['sensory', 'quiet', 'wheelchair'] })

      expect(store.rooms[0].capabilities).toEqual(['sensory', 'quiet', 'wheelchair'])
    })
  })

  describe('room status', () => {
    it('should store rooms with active and inactive status', async () => {
      vi.mocked(roomService.list).mockResolvedValue({
        data: mockRooms,
        total: 3,
        page: 1,
        limit: 50,
        totalPages: 1
      })

      const store = useRoomsStore()
      await store.fetchRooms()

      const activeRooms = store.rooms.filter(r => r.status === 'active')
      const inactiveRooms = store.rooms.filter(r => r.status === 'inactive')

      expect(activeRooms).toHaveLength(2)
      expect(inactiveRooms).toHaveLength(1)
    })

    it('should toggle room status', async () => {
      const updatedRoom = {
        ...mockRooms[0],
        status: 'inactive' as const
      }
      vi.mocked(roomService.update).mockResolvedValue({ data: updatedRoom })

      const store = useRoomsStore()
      store.rooms = [...mockRooms]

      await store.updateRoom('room-1', { status: 'inactive' })

      expect(store.rooms[0].status).toBe('inactive')
    })
  })
})
