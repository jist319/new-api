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
import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StaticDataTable } from '@/components/data-table/static/static-data-table'
import { StaticRowActions } from '@/components/data-table/static/static-row-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { safeJsonParseWithValidation } from '../utils/json-parser'
import { isObjectRecord } from '../utils/json-validators'
import {
  GroupConcurrencyDialog,
  type GroupConcurrencyEntryData,
} from './concurrency-limit-dialog'

type GroupConcurrencyVisualEditorProps = {
  value: string
  onChange: (value: string) => void
}

export function GroupConcurrencyVisualEditor({
  value,
  onChange,
}: GroupConcurrencyVisualEditorProps) {
  const { t } = useTranslation()
  const [searchText, setSearchText] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editData, setEditData] = useState<GroupConcurrencyEntryData | null>(
    null
  )

  const entries = useMemo(() => {
    if (!value || value.trim() === '') return []

    const parsed = safeJsonParseWithValidation<Record<string, unknown>>(value, {
      fallback: {},
      validator: isObjectRecord,
      validatorMessage: 'Concurrency limits must be a JSON object',
      context: 'group concurrency limits',
    })

    return Object.entries(parsed)
      .map(([groupName, limit]) =>
        typeof limit === 'number' ? { groupName, maxConcurrency: limit } : null
      )
      .filter((item): item is GroupConcurrencyEntryData => item !== null)
  }, [value])

  const filteredEntries = useMemo(() => {
    if (!searchText) return entries
    const lowerSearch = searchText.toLowerCase()
    return entries.filter((entry) =>
      entry.groupName.toLowerCase().includes(lowerSearch)
    )
  }, [entries, searchText])

  const handleSave = (data: GroupConcurrencyEntryData) => {
    const parsed = safeJsonParseWithValidation<Record<string, unknown>>(value, {
      fallback: {},
      validator: isObjectRecord,
      silent: true,
    })

    if (editData && editData.groupName !== data.groupName) {
      delete parsed[editData.groupName]
    }

    parsed[data.groupName] = data.maxConcurrency

    onChange(JSON.stringify(parsed, null, 2))
  }

  const handleDelete = (groupName: string) => {
    const parsed = safeJsonParseWithValidation<Record<string, unknown>>(value, {
      fallback: {},
      validator: isObjectRecord,
      silent: true,
    })

    delete parsed[groupName]

    onChange(JSON.stringify(parsed, null, 2))
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-4'>
        <div className='relative flex-1'>
          <Search className='text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4' />
          <Input
            placeholder={t('Search group names...')}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className='pl-9'
          />
        </div>
        <Button
          onClick={() => {
            setEditData(null)
            setDialogOpen(true)
          }}
        >
          <Plus className='mr-2 h-4 w-4' />
          {t('Add group')}
        </Button>
      </div>

      <StaticDataTable
        data={filteredEntries}
        getRowKey={(entry) => entry.groupName}
        emptyContent={
          searchText
            ? t('No groups match your search')
            : t(
                'No group concurrency limits configured. Click "Add group" to get started.'
              )
        }
        columns={[
          {
            id: 'group',
            header: t('Group Name'),
            cellClassName: 'font-medium',
            cell: (entry) => entry.groupName,
          },
          {
            id: 'max-concurrency',
            header: t('Max Concurrency Per User'),
            className: 'text-right',
            cellClassName: 'text-right',
            cell: (entry) => (
              <span className='font-mono'>
                {entry.maxConcurrency === 0
                  ? t('Unlimited')
                  : entry.maxConcurrency.toLocaleString()}
              </span>
            ),
          },
          {
            id: 'actions',
            header: t('Actions'),
            className: 'text-right',
            cellClassName: 'text-right',
            cell: (entry) => (
              <StaticRowActions
                editLabel={t('Edit')}
                deleteLabel={t('Delete')}
                menuLabel={t('Open menu')}
                onEdit={() => {
                  setEditData(entry)
                  setDialogOpen(true)
                }}
                onDelete={() => handleDelete(entry.groupName)}
              />
            ),
          },
        ]}
      />

      <GroupConcurrencyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        editData={editData}
      />
    </div>
  )
}
