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
import { History, PanelLeftClose, PanelLeftOpen, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { ChatHistoryEntry } from '../../types'

interface PlaygroundHistoryPanelProps {
  history: ChatHistoryEntry[]
  currentId: string | null
  onSelect: (entry: ChatHistoryEntry) => void
  onNew: () => void
  onDelete: (id: string) => void
}

function formatHistoryTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString([], { month: 'numeric', day: 'numeric' })
}

/**
 * Left-hand chat history panel. Conversations are stored in the user's local
 * browser (localStorage) and listed here for quick reload/deletion.
 */
export function PlaygroundHistoryPanel({
  history,
  currentId,
  onSelect,
  onNew,
  onDelete,
}: PlaygroundHistoryPanelProps) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)

  // Collapsed state: a slim strip that can be expanded again.
  if (collapsed) {
    return (
      <aside className='bg-muted/20 flex w-10 shrink-0 flex-col items-center gap-2 border-r py-2'>
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label={t('Expand history')}
          onClick={() => setCollapsed(false)}
        >
          <PanelLeftOpen className='size-4' />
        </Button>
      </aside>
    )
  }

  return (
    <aside className='bg-muted/20 hidden w-60 shrink-0 flex-col border-r md:flex'>
      <div className='flex items-center justify-between gap-2 border-b px-3 py-2.5'>
        <div className='flex items-center gap-1.5 text-sm font-medium'>
          <History className='size-4' />
          <span>{t('History')}</span>
        </div>
        <div className='flex items-center gap-1'>
          <Button
            variant='ghost'
            size='icon-sm'
            aria-label={t('Collapse history')}
            onClick={() => setCollapsed(true)}
          >
            <PanelLeftClose className='size-4' />
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='gap-1 px-2 text-xs'
            onClick={onNew}
          >
            <Plus className='size-3.5' />
            {t('New Chat')}
          </Button>
        </div>
      </div>

      <div className='flex-1 overflow-y-auto p-2'>
        {history.length === 0 ? (
          <p className='text-muted-foreground px-2 py-6 text-center text-xs'>
            {t('No chat history yet')}
          </p>
        ) : (
          <ul className='space-y-1'>
            {history.map((entry) => (
              <li key={entry.id}>
                <div
                  className={cn(
                    'group flex w-full items-start gap-1 rounded-md px-2 py-1.5 hover:bg-accent',
                    entry.id === currentId && 'bg-accent'
                  )}
                >
                  <button
                    type='button'
                    className='min-w-0 flex-1 text-left'
                    onClick={() => onSelect(entry)}
                  >
                    <div className='truncate text-xs font-medium'>
                      {entry.title || t('New Chat')}
                    </div>
                    <div className='text-muted-foreground text-[11px]'>
                      {formatHistoryTime(entry.updatedAt)}
                      {entry.model ? ` · ${entry.model}` : ''}
                    </div>
                  </button>
                  <button
                    type='button'
                    aria-label={t('Delete')}
                    className='text-muted-foreground hover:text-destructive opacity-0 transition-opacity group-hover:opacity-100'
                    onClick={() => onDelete(entry.id)}
                  >
                    <Trash2 className='size-3.5' />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}