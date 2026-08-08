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
import { useCallback, useEffect, useRef, useState } from 'react'

import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED } from '../constants'
import {
  saveConfig,
  saveParameterEnabled,
  saveMessages,
  applyMessageStateUpdate,
  getInitialParameterEnabled,
  getInitialPlaygroundConfig,
  loadMessages,
  type MessageStateUpdater,
} from '../lib'
import {
  deleteChatHistory,
  loadChatHistory,
  upsertChatHistory,
} from '../lib/storage/history'
import type {
  Message,
  PlaygroundConfig,
  ParameterEnabled,
  ModelOption,
  GroupOption,
  ChatHistoryEntry,
} from '../types'

const MESSAGE_SAVE_DEBOUNCE_MS = 500
const HISTORY_SAVE_DEBOUNCE_MS = 800
const HISTORY_TITLE_MAX_LENGTH = 40

function createHistoryId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function deriveHistoryTitle(messages: Message[]): string {
  const firstUser = messages.find((message) => message.from === 'user')
  const content = firstUser?.versions[0]?.content?.trim() ?? ''
  const singleLine = content.replace(/\s+/g, ' ')
  if (!singleLine) return ''
  return singleLine.length > HISTORY_TITLE_MAX_LENGTH
    ? `${singleLine.slice(0, HISTORY_TITLE_MAX_LENGTH)}…`
    : singleLine
}

function hasPendingMessage(messages: Message[]): boolean {
  return messages.some(
    (message) => message.status === 'loading' || message.status === 'streaming'
  )
}

/**
 * Main state management hook for playground
 */
export function usePlaygroundState() {
  // Load initial state from localStorage
  const [config, setConfig] = useState<PlaygroundConfig>(
    getInitialPlaygroundConfig
  )

  const [parameterEnabled, setParameterEnabled] = useState<ParameterEnabled>(
    getInitialParameterEnabled
  )

  const [messages, setMessages] = useState<Message[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(true)
  const [history, setHistory] = useState<ChatHistoryEntry[]>(() =>
    loadChatHistory()
  )
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null)
  const currentHistoryIdRef = useRef<string | null>(null)
  const messagesSaveTimerRef = useRef<number | null>(null)
  const historySaveTimerRef = useRef<number | null>(null)
  const latestMessagesRef = useRef<Message[]>(messages)
  const latestConfigRef = useRef<PlaygroundConfig>(config)
  const hasLoadedMessagesRef = useRef(false)
  const historyRef = useRef<ChatHistoryEntry[]>(history)

  const [models, setModels] = useState<ModelOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])

  const persistHistory = useCallback((messagesToSave: Message[]) => {
    if (messagesToSave.length === 0 || hasPendingMessage(messagesToSave)) {
      return
    }
    const cfg = latestConfigRef.current
    const now = Date.now()
    let id = currentHistoryIdRef.current
    if (!id) {
      id = createHistoryId()
      currentHistoryIdRef.current = id
      setCurrentHistoryId(id)
    }
    const existing = historyRef.current.find((entry) => entry.id === id)
    const title =
      deriveHistoryTitle(messagesToSave) || existing?.title || 'New Chat'
    const entry: ChatHistoryEntry = {
      id,
      title,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      model: cfg.model,
      group: cfg.group,
      messages: messagesToSave,
    }
    const next = upsertChatHistory(entry)
    historyRef.current = next
    setHistory(next)
  }, [])

  const persistMessages = useCallback(
    (messagesToSave: Message[]) => {
      latestMessagesRef.current = messagesToSave

      if (!hasLoadedMessagesRef.current) {
        return
      }

      if (messagesSaveTimerRef.current !== null) {
        window.clearTimeout(messagesSaveTimerRef.current)
      }

      messagesSaveTimerRef.current = window.setTimeout(() => {
        messagesSaveTimerRef.current = null
        saveMessages(latestMessagesRef.current)
      }, MESSAGE_SAVE_DEBOUNCE_MS)

      if (historySaveTimerRef.current !== null) {
        window.clearTimeout(historySaveTimerRef.current)
      }
      historySaveTimerRef.current = window.setTimeout(() => {
        historySaveTimerRef.current = null
        persistHistory(latestMessagesRef.current)
      }, HISTORY_SAVE_DEBOUNCE_MS)
    },
    [persistHistory]
  )

  useEffect(() => {
    let cancelled = false

    window.setTimeout(() => {
      const loadedMessages = loadMessages() ?? []
      if (cancelled) {
        return
      }

      latestMessagesRef.current = loadedMessages
      hasLoadedMessagesRef.current = true
      setMessages(loadedMessages)
      setIsLoadingMessages(false)
    }, 0)

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(
    () => () => {
      if (messagesSaveTimerRef.current !== null) {
        window.clearTimeout(messagesSaveTimerRef.current)
        saveMessages(latestMessagesRef.current)
      }
      if (historySaveTimerRef.current !== null) {
        window.clearTimeout(historySaveTimerRef.current)
        persistHistory(latestMessagesRef.current)
      }
    },
    [persistHistory]
  )

  // Update config with automatic save
  const updateConfig = useCallback(
    <K extends keyof PlaygroundConfig>(key: K, value: PlaygroundConfig[K]) => {
      setConfig((prev) => {
        const updated = { ...prev, [key]: value }
        latestConfigRef.current = updated
        saveConfig(updated)
        return updated
      })
    },
    []
  )

  // Update parameter enabled with automatic save
  const updateParameterEnabled = useCallback(
    (key: keyof ParameterEnabled, value: boolean) => {
      setParameterEnabled((prev) => {
        const updated = { ...prev, [key]: value }
        saveParameterEnabled(updated)
        return updated
      })
    },
    []
  )

  // Update messages with automatic save
  const updateMessages = useCallback(
    (updater: MessageStateUpdater) => {
      setMessages((prev) => {
        const newMessages = applyMessageStateUpdate(prev, updater)
        persistMessages(newMessages)
        return newMessages
      })
    },
    [persistMessages]
  )

  // Clear all messages
  const clearMessages = useCallback(() => {
    updateMessages([])
  }, [updateMessages])

  // Reset config to defaults
  const resetConfig = useCallback(() => {
    setConfig(DEFAULT_CONFIG)
    setParameterEnabled(DEFAULT_PARAMETER_ENABLED)
    saveConfig(DEFAULT_CONFIG)
    saveParameterEnabled(DEFAULT_PARAMETER_ENABLED)
  }, [])

  // Load a saved chat history entry into the current conversation
  const loadHistoryEntry = useCallback(
    (entry: ChatHistoryEntry) => {
      updateMessages(entry.messages)
      saveMessages(entry.messages)
      currentHistoryIdRef.current = entry.id
      setCurrentHistoryId(entry.id)
      if (entry.model) updateConfig('model', entry.model)
      if (entry.group) updateConfig('group', entry.group)
    },
    [updateMessages, updateConfig]
  )

  // Start a brand-new conversation (clears the editor and current history id)
  const startNewConversation = useCallback(() => {
    clearMessages()
    currentHistoryIdRef.current = null
    setCurrentHistoryId(null)
  }, [clearMessages])

  // Delete one history entry; detach it if it is the active conversation
  const deleteHistoryEntry = useCallback((id: string) => {
    const next = deleteChatHistory(id)
    historyRef.current = next
    setHistory(next)
    if (currentHistoryIdRef.current === id) {
      currentHistoryIdRef.current = null
      setCurrentHistoryId(null)
    }
  }, [])

  return {
    // State
    config,
    parameterEnabled,
    messages,
    isLoadingMessages,
    models,
    groups,

    // Setters
    setModels,
    setGroups,

    // Actions
    updateConfig,
    updateParameterEnabled,
    updateMessages,
    clearMessages,
    resetConfig,

    // Chat history (local browser storage)
    history,
    currentHistoryId,
    loadHistoryEntry,
    startNewConversation,
    deleteHistoryEntry,
  }
}
