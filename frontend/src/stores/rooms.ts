import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Room } from '@/types'
import { roomService } from '@/services/api'

export const useRoomsStore = defineStore('rooms', () => {
  const rooms = ref<Room[]>([])
  const currentRoom = ref<Room | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const totalCount = ref(0)

  async function fetchRooms(params?: { search?: string; status?: string }) {
    loading.value = true
    error.value = null
    try {
      const response = await roomService.list(params)
      rooms.value = response.data
      totalCount.value = response.total
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch rooms'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchRoomById(id: string) {
    loading.value = true
    error.value = null
    try {
      const response = await roomService.get(id)
      currentRoom.value = response.data
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch room'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createRoom(data: Partial<Room>) {
    loading.value = true
    error.value = null
    try {
      const response = await roomService.create(data)
      rooms.value.push(response.data)
      totalCount.value++
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create room'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateRoom(id: string, data: Partial<Room>) {
    loading.value = true
    error.value = null
    try {
      const response = await roomService.update(id, data)
      const index = rooms.value.findIndex((r) => r.id === id)
      if (index !== -1) {
        rooms.value[index] = response.data
      }
      if (currentRoom.value?.id === id) {
        currentRoom.value = response.data
      }
      return response.data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update room'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteRoom(id: string) {
    loading.value = true
    error.value = null
    try {
      await roomService.delete(id)
      rooms.value = rooms.value.filter((r) => r.id !== id)
      totalCount.value--
      if (currentRoom.value?.id === id) {
        currentRoom.value = null
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete room'
      throw e
    } finally {
      loading.value = false
    }
  }

  function clearCurrent() {
    currentRoom.value = null
  }

  return {
    rooms,
    currentRoom,
    loading,
    error,
    totalCount,
    fetchRooms,
    fetchRoomById,
    createRoom,
    updateRoom,
    deleteRoom,
    clearCurrent
  }
})
