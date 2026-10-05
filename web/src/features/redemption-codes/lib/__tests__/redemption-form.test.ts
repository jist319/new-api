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
import type { TFunction } from 'i18next'
import { beforeEach, expect, test } from 'vitest'

import { DEFAULT_CURRENCY_CONFIG, useSystemConfigStore } from '@/stores/system-config-store'

import type { Redemption } from '../../types'
import {
  getRedemptionFormSchema,
  REDEMPTION_FORM_DEFAULT_VALUES,
  transformFormDataToPayload,
  transformRedemptionToFormDefaults,
  type RedemptionFormValues,
} from '../redemption-form'

const t = ((key: string) => key) as unknown as TFunction

function redemption(overrides: Partial<Redemption> = {}): Redemption {
  return {
    id: 1,
    user_id: 1,
    name: 'code',
    key: 'key',
    status: 1,
    quota: 0,
    created_time: 1,
    redeemed_time: 0,
    expired_time: 0,
    used_user_id: 0,
    group: '',
    type: 'quota',
    plan_id: 0,
    ...overrides,
  }
}

beforeEach(() => {
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
})

test('a subscription payload keeps the plan and carries no quota', () => {
  const payload = transformFormDataToPayload({
    ...REDEMPTION_FORM_DEFAULT_VALUES,
    name: 'sub',
    type: 'subscription',
    plan_id: 7,
    group: ' vip ',
  })

  expect(payload).toMatchObject({
    name: 'sub',
    type: 'subscription',
    plan_id: 7,
    quota: 0,
    group: 'vip',
  })
})

test('a quota payload never leaks a plan id', () => {
  const payload = transformFormDataToPayload({
    ...REDEMPTION_FORM_DEFAULT_VALUES,
    name: 'quota',
    type: 'quota',
    plan_id: 7,
    group: 'vip',
  })

  expect(payload.plan_id).toBe(0)
  expect(payload.quota).toBeGreaterThan(0)
})

test('a subscription code round-trips through the form without becoming a quota code', () => {
  const values = transformRedemptionToFormDefaults(
    redemption({ type: 'subscription', plan_id: 9, group: 'vip' })
  )

  expect(values.type).toBe('subscription')
  expect(values.plan_id).toBe(9)

  const payload = transformFormDataToPayload(values)
  expect(payload.type).toBe('subscription')
  expect(payload.plan_id).toBe(9)
})

test('a legacy row without a type is treated as a quota code', () => {
  const values = transformRedemptionToFormDefaults(
    redemption({ type: '', quota: 500_000 })
  )

  expect(values.type).toBe('quota')
  expect(values.plan_id).toBe(0)
})

test('the schema requires a plan for subscription codes and a quota otherwise', () => {
  const schema = getRedemptionFormSchema(t)
  const base: RedemptionFormValues = {
    ...REDEMPTION_FORM_DEFAULT_VALUES,
    name: 'code',
  }

  expect(schema.safeParse({ ...base, type: 'subscription' }).success).toBe(false)
  expect(
    schema.safeParse({ ...base, type: 'subscription', plan_id: 3 }).success
  ).toBe(true)
  expect(
    schema.safeParse({ ...base, type: 'quota', quota_dollars: 0 }).success
  ).toBe(false)
  expect(
    schema.safeParse({ ...base, type: 'quota', quota_dollars: 5 }).success
  ).toBe(true)
})
