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
 * Detection heuristic: browsers close the protocol tab automatically when the
 * OS successfully hands the link to an installed application. If the tab is
 * still open after a short delay (or the popup was blocked), we assume the app
 * is not installed, show a "please install" toast and open the download page.
 *
 * @returns true when the app was (most likely) launched, false otherwise.
 */
export async function openExternalApp(
  preset: ChatPreset,
  resolvedUrl: string,
  t: (key: string) => string
): Promise<boolean> {
  let win: Window | null = null
  try {
    win = window.open(resolvedUrl, '_blank', 'noopener')
  } catch {
    win = null
  }

  const launched = await new Promise<boolean>((resolve) => {
    window.setTimeout(() => {
      resolve(win !== null && win.closed)
    }, 1800)
  })

  if (!launched) {
    try {
      if (win && !win.closed) win.close()
    } catch {
      /* ignore */
    }
    toast.warning(t('Please install this app first'))
    window.open(getDownloadUrlForPreset(preset), '_blank', 'noopener')
    return false
  }

  return true
}