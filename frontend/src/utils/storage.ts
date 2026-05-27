/**
 * storage.ts — localStorage helper cho ERP Nam Phương
 *
 * Tính năng:
 *   1. TTL (Time-To-Live): dữ liệu tự xóa khi hết hạn
 *   2. clearAppStorage(): xóa toàn bộ dữ liệu ERP (trừ auth token)
 *   3. clearAll(): xóa mọi thứ (dùng khi logout)
 *   4. Type-safe với TypeScript generics
 *   5. Không throw — lỗi được xử lý nội bộ, trả về null/undefined
 *
 * Danh sách keys hiện tại trong ERP:
 *   AUTH:    token | refresh_token | user
 *   CD2:     cd2_worker_session | cd2_selected_xuong | cd2-in-pause-{id}
 *   FILTERS: theo-doi-filters
 *
 * Sử dụng:
 *   import { storage } from '../utils/storage'
 *
 *   storage.set('my_key', { a: 1 })                   // không TTL
 *   storage.set('my_key', { a: 1 }, { ttl: 3600 })    // hết hạn sau 1 giờ
 *   const val = storage.get<MyType>('my_key')          // null nếu hết hạn / không có
 *   storage.remove('my_key')
 *   storage.clearAppStorage()                          // xóa rác ERP (trừ auth)
 *   storage.clearAll()                                 // logout: xóa tất cả
 */

// ── Internal envelope ─────────────────────────────────────────────────────────

interface StorageEnvelope<T> {
  v: T            // value
  exp?: number    // expiry — unix ms (undefined = không hết hạn)
}

// ── Prefix & key registry ─────────────────────────────────────────────────────

/** Prefix chung của toàn bộ ERP — dùng để lọc khi clearAppStorage */
const APP_PREFIX = 'erp_np_'

/**
 * Danh sách keys hiện tại (KHÔNG có prefix, dùng tên gốc để tương thích).
 * Thêm key mới vào đây để được dọn dẹp khi clearAppStorage().
 */
const LEGACY_APP_KEYS = [
  // CD2 / Sản xuất
  'cd2_worker_session',
  'cd2_selected_xuong',
  // Filters
  'theo-doi-filters',
] as const

/** Keys xác thực — KHÔNG xóa khi clearAppStorage, CHỈ xóa khi clearAll */
const AUTH_KEYS = ['token', 'refresh_token', 'user'] as const

// ── Core API ──────────────────────────────────────────────────────────────────

interface SetOptions {
  /** Thời gian sống tính bằng giây. Ví dụ: 3600 = 1 giờ. */
  ttl?: number
}

function set<T>(key: string, value: T, options?: SetOptions): void {
  try {
    const envelope: StorageEnvelope<T> = {
      v: value,
      exp: options?.ttl ? Date.now() + options.ttl * 1000 : undefined,
    }
    localStorage.setItem(key, JSON.stringify(envelope))
  } catch (e) {
    console.warn(`[storage] set("${key}") failed:`, e)
  }
}

function get<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null

    // Thử parse envelope mới (có trường "v")
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      // Raw string không phải JSON → trả về raw (tương thích với code cũ)
      return raw as unknown as T
    }

    // Kiểm tra có phải envelope của chúng ta không
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'v' in (parsed as Record<string, unknown>)
    ) {
      const envelope = parsed as StorageEnvelope<T>
      // Kiểm tra TTL
      if (envelope.exp !== undefined && Date.now() > envelope.exp) {
        localStorage.removeItem(key)
        return null
      }
      return envelope.v
    }

    // Không phải envelope (dữ liệu cũ / ngoài hệ thống) → trả thẳng
    return parsed as T
  } catch (e) {
    console.warn(`[storage] get("${key}") failed:`, e)
    return null
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (e) {
    console.warn(`[storage] remove("${key}") failed:`, e)
  }
}

/**
 * Xóa dữ liệu ERP (không phải auth).
 * Dùng khi: người dùng hoàn tất quy trình, thoát session CD2, cleanup.
 */
function clearAppStorage(): void {
  try {
    // 1. Xóa legacy keys đã biết
    LEGACY_APP_KEYS.forEach(k => localStorage.removeItem(k))

    // 2. Xóa mọi key có prefix APP_PREFIX
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(APP_PREFIX)) toRemove.push(k)
    }
    toRemove.forEach(k => localStorage.removeItem(k))

    // 3. Xóa cd2-in-pause-* (dynamic keys)
    const pauseKeys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith('cd2-in-pause-')) pauseKeys.push(k)
    }
    pauseKeys.forEach(k => localStorage.removeItem(k))
  } catch (e) {
    console.warn('[storage] clearAppStorage() failed:', e)
  }
}

/**
 * Xóa TOÀN BỘ dữ liệu ERP bao gồm auth.
 * Dùng khi: người dùng đăng xuất (logout).
 */
function clearAll(): void {
  try {
    // Xóa auth keys
    AUTH_KEYS.forEach(k => localStorage.removeItem(k))
    // Xóa toàn bộ app storage
    clearAppStorage()
  } catch (e) {
    console.warn('[storage] clearAll() failed:', e)
  }
}

/**
 * Xóa tất cả keys đã quá hạn TTL trong localStorage.
 * Gọi ở khởi động app hoặc theo định kỳ.
 */
function purgeExpired(): void {
  try {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      const raw = localStorage.getItem(k)
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw) as Partial<StorageEnvelope<unknown>>
        if (parsed.exp !== undefined && Date.now() > parsed.exp) {
          toRemove.push(k)
        }
      } catch {
        // Không phải JSON envelope → bỏ qua
      }
    }
    toRemove.forEach(k => localStorage.removeItem(k))
    if (toRemove.length > 0) {
      console.debug(`[storage] purgeExpired: removed ${toRemove.length} keys`)
    }
  } catch (e) {
    console.warn('[storage] purgeExpired() failed:', e)
  }
}

// ── Typed shortcuts cho keys phổ biến ────────────────────────────────────────

/** Lưu bộ lọc màn hình (TTL 7 ngày) */
function saveFilters<T>(screenKey: string, filters: T): void {
  set(`${APP_PREFIX}filters_${screenKey}`, filters, { ttl: 7 * 24 * 3600 })
}

function loadFilters<T>(screenKey: string): T | null {
  return get<T>(`${APP_PREFIX}filters_${screenKey}`)
}

function clearFilters(screenKey: string): void {
  remove(`${APP_PREFIX}filters_${screenKey}`)
}

// ── Export ────────────────────────────────────────────────────────────────────

export const storage = {
  set,
  get,
  remove,
  clearAppStorage,
  clearAll,
  purgeExpired,
  saveFilters,
  loadFilters,
  clearFilters,
  APP_PREFIX,
}

// ── TTL constants (giây) ──────────────────────────────────────────────────────

export const TTL = {
  MINUTE:  60,
  HOUR:    3_600,
  DAY:     86_400,
  WEEK:    604_800,
  MONTH:   2_592_000,
} as const
