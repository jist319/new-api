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
import { History, Info, PanelLeftClose, PanelLeftOpen, Plus, Trash2 } from 'lucide-react'
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
  const [mobileOpen, setMobileOpen] = useState(false)

  const closeMobile = () => setMobileOpen(false)

  return (
    <>
      <aside
        className={cn(
          'bg-background md:bg-muted/20 flex shrink-0 flex-col overflow-hidden border-r transition-[transform,width] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
          'absolute inset-y-0 left-0 z-30 w-1/2 shadow-xl md:static md:z-auto',
          mobileOpen
            ? 'translate-x-0'
            : '-translate-x-full pointer-events-none',
          'md:translate-x-0 md:pointer-events-auto',
          collapsed ? 'md:w-0 md:border-r-0' : 'md:w-60'
        )}
      >
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
            onClick={() => {
              // Mobile: close the drawer; desktop: collapse the side panel.
              setMobileOpen(false)
              setCollapsed(true)
            }}
          >
            <PanelLeftClose className='size-4' />
          </Button>
          <Button
            variant='ghost'
            size='sm'
            className='gap-1 px-2 text-xs'
            onClick={() => {
              closeMobile()
              onNew()
            }}
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
                    onClick={() => {
                      closeMobile()
                      onSelect(entry)
                    }}
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

      <div className='text-muted-foreground flex items-start gap-1.5 border-t px-3 py-2'>
        <Info className='mt-0.5 size-3.5 shrink-0' />
        <p className='text-[11px] leading-4'>
          {t(
            'History is stored only in this browser and is not synced to the server.'
          )}
        </p>
      </div>
      </aside>

      {/* Mobile: floating history entry button (hidden on md+) */}
      {!mobileOpen && (
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label={t('Expand history')}
          onClick={() => setMobileOpen(true)}
          className='bg-background/80 absolute top-2 left-2 z-10 rounded-md shadow-sm backdrop-blur md:hidden'
        >
          <PanelLeftOpen className='size-4' />
        </Button>
      )}

      {/* Mobile: backdrop to close the history drawer (fades in/out) */}
      <div
        className={cn(
          'absolute inset-0 z-20 bg-black/40 transition-opacity duration-500 md:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={closeMobile}
      />

      {collapsed && (
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label={t('Expand history')}
          onClick={() => setCollapsed(false)}
          className='animate-in fade-in-0 slide-in-from-left-2 absolute top-2 left-2 z-10 hidden duration-200 md:inline-flex'
        >
          <PanelLeftOpen className='size-4' />
        </Button>
      )}
    </>
  )
}
