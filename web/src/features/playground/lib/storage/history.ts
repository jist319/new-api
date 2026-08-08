/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { MAX_CHAT_HISTORY_ENTRIES, STORAGE_KEYS } from '../../constants'
import type { ChatHistoryEntry } from '../../types'

function readHistory(): ChatHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.CHAT_HISTORY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is ChatHistoryEntry =>
        !!entry &&
        typeof (entry as ChatHistoryEntry).id === 'string' &&
        Array.isArray((entry as ChatHistoryEntry).messages)
    )
  } catch {
    return []
  }
}

function writeHistory(entries: ChatHistoryEntry[]): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEYS.CHAT_HISTORY,
      JSON.stringify(entries.slice(0, MAX_CHAT_HISTORY_ENTRIES))
    )
  } catch {
    /* ignore quota/availability errors */
  }
}

/** Load all locally saved chat history entries (newest first). */
export function loadChatHistory(): ChatHistoryEntry[] {
  return readHistory()
}

/** Insert or update an entry, keeping the list capped at the maximum size. */
export function upsertChatHistory(entry: ChatHistoryEntry): ChatHistoryEntry[] {
  const list = readHistory()
  const index = list.findIndex((item) => item.id === entry.id)
  if (index >= 0) {
    list[index] = entry
  } else {
    list.unshift(entry)
  }
  writeHistory(list)
  return list.slice(0, MAX_CHAT_HISTORY_ENTRIES)
}

/** Remove a single history entry. */
export function deleteChatHistory(id: string): ChatHistoryEntry[] {
  const list = readHistory().filter((entry) => entry.id !== id)
  writeHistory(list)
  return list
}

/** Remove all locally saved chat history. */
export function clearChatHistory(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEYS.CHAT_HISTORY)
  } catch {
    /* ignore */
  }
}