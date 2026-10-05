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

import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { formatTotalQuota } from '../format'

const t = ((key: string) => key) as unknown as TFunction

beforeEach(() => {
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
})

test('zero total reads as no quota, not unlimited', () => {
  expect(formatTotalQuota(0, t)).toBe('No quota')
})

test('a negative total reads as unlimited', () => {
  expect(formatTotalQuota(-1, t)).toBe('Unlimited')
})

test('a positive total is rendered as quota units', () => {
  const rendered = formatTotalQuota(500_000, t)

  expect(rendered).not.toBe('Unlimited')
  expect(rendered).not.toBe('No quota')
  expect(rendered).not.toBe('')
})
