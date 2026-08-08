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
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

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

import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const schema = z.object({
  link: z.string().url().or(z.literal('')).optional(),
})

type Values = z.infer<typeof schema>

export function RedemptionCodeSettingsSection({
  defaultValues,
}: {
  defaultValues: {
    RedemptionCodeLink: string
  }
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: {
      link: defaultValues.RedemptionCodeLink,
    },
  })

  const { isDirty, isSubmitting } = form.formState

  async function onSubmit(values: Values) {
    const nextLink = values.link?.trim() ?? ''
    if (nextLink === defaultValues.RedemptionCodeLink) {
      toast.info(t('No changes to save'))
      return
    }

    await updateOption.mutateAsync({
      key: 'RedemptionCodeLink',
      value: nextLink,
    })
    form.reset(values)
  }

  return (
    <SettingsSection title={t('Redemption Code')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!isDirty}
            saveLabel='Save redemption code settings'
          />
          <FormField
            control={form.control}
            name='link'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Redemption code link')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('https://example.com/redeem')}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    "Link that the 'Get Redemption Code' button jumps to."
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
