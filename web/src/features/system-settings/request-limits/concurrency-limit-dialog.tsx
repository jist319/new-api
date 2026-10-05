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
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

const concurrencyDialogSchema = z.object({
  groupName: z.string().min(1, 'Group name is required'),
  maxConcurrency: z
    .number()
    .min(0, 'Must be ≥ 0')
    .max(100000, 'Must be ≤ 100,000'),
})

type ConcurrencyDialogFormValues = z.infer<typeof concurrencyDialogSchema>

const CONCURRENCY_FORM_ID = 'group-concurrency-form'

export type GroupConcurrencyEntryData = {
  groupName: string
  maxConcurrency: number
}

const EMPTY_ENTRY: GroupConcurrencyEntryData = {
  groupName: '',
  maxConcurrency: 1,
}

type GroupConcurrencyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: GroupConcurrencyEntryData) => void
  editData?: GroupConcurrencyEntryData | null
}

export function GroupConcurrencyDialog({
  open,
  onOpenChange,
  onSave,
  editData,
}: GroupConcurrencyDialogProps) {
  const { t } = useTranslation()
  const isEditMode = !!editData

  const form = useForm<ConcurrencyDialogFormValues>({
    resolver: zodResolver(concurrencyDialogSchema),
    defaultValues: EMPTY_ENTRY,
  })

  useEffect(() => {
    form.reset(editData ?? EMPTY_ENTRY)
  }, [editData, form, open])

  const handleSubmit = (values: ConcurrencyDialogFormValues) => {
    onSave(values)
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        isEditMode
          ? t('Edit group concurrency limit')
          : t('Add group concurrency limit')
      }
      description={t(
        'Cap how many requests one user may run at the same time in a group.'
      )}
      contentClassName='sm:max-w-[500px]'
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button type='submit' form={CONCURRENCY_FORM_ID}>
            {isEditMode ? t('Update') : t('Add')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id={CONCURRENCY_FORM_ID}
          onSubmit={form.handleSubmit(handleSubmit)}
          className='space-y-4'
        >
          <FormField
            control={form.control}
            name='groupName'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Group Name')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('e.g., default, vip, premium')}
                    {...field}
                    disabled={isEditMode}
                  />
                </FormControl>
                <FormDescription>
                  {isEditMode
                    ? t('Group name cannot be changed when editing.')
                    : t('Unique identifier for this group.')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='maxConcurrency'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Max Concurrency Per User')}</FormLabel>
                <FormControl>
                  <div className='flex items-center gap-2'>
                    <Input
                      type='number'
                      min={0}
                      max={100000}
                      step={1}
                      {...field}
                      onChange={(e) =>
                        field.onChange(Number.parseInt(e.target.value) || 0)
                      }
                    />
                    <span className='text-muted-foreground text-sm'>
                      {t('requests')}
                    </span>
                  </div>
                </FormControl>
                <FormDescription>
                  {t(
                    'Requests one user may run at the same time in this group, counting unfinished tasks. 0 = unlimited.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </Dialog>
  )
}
