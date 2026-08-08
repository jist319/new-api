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
import { toast } from 'sonner'

import type { ChatPreset } from './chat-links'

/**
 * Official download pages for desktop/mobile chat clients that are opened
 * through custom protocol links (ccswitch://, cherrystudio://, ...).
 */
export const APP_DOWNLOAD_URLS: Record<string, string> = {
  ccswitch: 'https://ccswitch.io',
  cherrystudio: 'https://cherryai.com.cn/download',
  aionui: 'https://aionui.site/download/',
  deepchat: 'https://github.com/ThinkInAIXYZ/deepchat/releases',
  opencat: 'https://apps.apple.com/us/app/opencat-chat-with-ai-bot/id6445999201',
  ama: 'https://apps.apple.com/hk/app/botgem/id6446135619',
  fluentread: 'https://github.com/Bistutu/FluentRead',
}

/** Resolve the download/install page for a chat preset. */
export function getDownloadUrlForPreset(preset: ChatPreset): string {
  const scheme = preset.url.split(':')[0].toLowerCase()
  const mapped = APP_DOWNLOAD_URLS[scheme]
  if (mapped) return mapped
  return `https://www.google.com/search?q=${encodeURIComponent(`${preset.name} 下载`)}`
}

/**
 * Try to launch an external desktop app through a custom protocol link.
 *
 * Detection: a hidden same-tab iframe attempts the protocol URL. When the OS
 * hands the link to an installed application, the app window takes focus and
 * our page fires a `blur` event; when no handler exists (or the launch is
 * blocked) the page keeps focus. This avoids racing Chrome's native
 * "Open …?" confirmation dialog and does not open an extra tab.
 *
 * @returns true when the app was (most likely) launched, false otherwise.
 */
export async function openExternalApp(
  preset: ChatPreset,
  resolvedUrl: string
): Promise<boolean> {
  const launched = await new Promise<boolean>((resolve) => {
    let blurred = false
    const onBlur = () => {
      blurred = true
    }
    window.addEventListener('blur', onBlur)

    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.setAttribute('aria-hidden', 'true')
    iframe.src = resolvedUrl
    document.body.appendChild(iframe)

    window.setTimeout(() => {
      window.removeEventListener('blur', onBlur)
      iframe.remove()
      resolve(blurred)
    }, 2500)
  })

  if (!launched) {
    toast.warning('请先安装此应用')
    // Use same-tab navigation so Chrome's popup blocker cannot swallow the
    // download page (the async detection has already lost user activation).
    window.location.href = getDownloadUrlForPreset(preset)
    return false
  }

  return true
}