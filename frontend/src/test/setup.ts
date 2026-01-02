import { vi } from 'vitest'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null)
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock window.location
const locationMock = {
  href: '',
  origin: 'http://localhost:5173',
  pathname: '/',
  search: '',
  hash: '',
  host: 'localhost:5173',
  hostname: 'localhost',
  port: '5173',
  protocol: 'http:',
  assign: vi.fn(),
  reload: vi.fn(),
  replace: vi.fn()
}

Object.defineProperty(window, 'location', {
  value: locationMock,
  writable: true
})

// Reset mocks between tests
beforeEach(() => {
  localStorageMock.clear()
  vi.clearAllMocks()
  locationMock.href = ''
})
