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
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { GroupConcurrencyVisualEditor } from '../concurrency-limit-visual-editor'

describe('group concurrency visual editor', () => {
  test('renders each configured group with its limit', () => {
    render(
      <GroupConcurrencyVisualEditor
        value='{"default": 3, "vip": 0}'
        onChange={vi.fn()}
      />
    )

    expect(screen.getByText('default')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('vip')).toBeInTheDocument()
    // 0 means the group is unlimited, not a limit of zero.
    expect(screen.getByText('Unlimited')).toBeInTheDocument()
  })

  test('adding a group preserves the limits already configured', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <GroupConcurrencyVisualEditor
        value='{"default": 3}'
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Add group' }))

    const dialog = await screen.findByRole('dialog')
    await user.type(
      within(dialog).getByPlaceholderText('e.g., default, vip, premium'),
      'vip'
    )
    const limitInput = within(dialog).getByRole('spinbutton')
    await user.clear(limitInput)
    await user.type(limitInput, '5')
    await user.click(within(dialog).getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(JSON.parse(onChange.mock.calls.at(-1)?.[0] ?? '{}')).toEqual({
      default: 3,
      vip: 5,
    })
  })
})
