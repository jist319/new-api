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
import { GlobeIcon, PaperclipIcon, Trash2Icon } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  PromptInputButton,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import { ATTACHMENT_ACTIONS } from '../../lib'
import type { ParameterEnabled, PlaygroundConfig } from '../../types'
import { PlaygroundParameterPanel } from './playground-parameter-panel'

type PlaygroundInputToolsProps = {
  config: PlaygroundConfig
  disabled?: boolean
  hasMessages?: boolean
  onAddAttachments: (
    items: {
      name: string
      dataUrl?: string
      text?: string
      kind: 'image' | 'text'
    }[]
  ) => void
  onClearMessages?: () => void
  onConfigChange: <K extends keyof PlaygroundConfig>(
    key: K,
    value: PlaygroundConfig[K]
  ) => void
  onParameterEnabledChange: (
    key: keyof ParameterEnabled,
    value: boolean
  ) => void
  onSearchChange: (value: boolean) => void
  parameterEnabled: ParameterEnabled
  searchEnabled: boolean
}

export function PlaygroundInputTools({
  config,
  disabled,
  hasMessages = false,
  onAddAttachments,
  onClearMessages,
  onConfigChange,
  onParameterEnabledChange,
  onSearchChange,
  parameterEnabled,
  searchEnabled,
}: PlaygroundInputToolsProps) {
  const { t } = useTranslation()
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const TEXT_FILE_TYPES = new Set([
    'text/plain',
    'text/markdown',
    'text/csv',
    'text/html',
    'text/css',
    'text/xml',
    'application/json',
    'application/x-yaml',
    'application/javascript',
    'application/typescript',
    'application/x-sh',
  ])

  const isImageFile = (file: File) => file.type.startsWith('image/')

  const isTextFile = (file: File) =>
    TEXT_FILE_TYPES.has(file.type) ||
    /\\.(txt|md|markdown|csv|tsv|log|json|py|js|mjs|cjs|ts|tsx|jsx|go|java|c|cpp|h|hpp|cs|rb|php|rs|swift|kt|kts|sql|sh|bash|ps1|html|htm|css|scss|xml|yaml|yml|toml|ini)$/i.test(
      file.name
    )

  const readFilesAsAttachments = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const items: {
      name: string
      dataUrl?: string
      text?: string
      kind: 'image' | 'text'
    }[] = []
    let pending = files.length
    const finish = () => {
      pending -= 1
      if (pending === 0) {
        if (items.length > 0) {
          onAddAttachments(items)
          toast.success(t('Attachments added'))
        }
      }
    }
    for (const file of Array.from(files)) {
      if (isImageFile(file)) {
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            items.push({ name: file.name, dataUrl: reader.result, kind: 'image' })
          }
          finish()
        }
        reader.onerror = () => finish()
        reader.readAsDataURL(file)
      } else if (isTextFile(file)) {
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            items.push({
              name: file.name,
              text: reader.result.slice(0, 20000),
              kind: 'text',
            })
          }
          finish()
        }
        reader.onerror = () => finish()
        reader.readAsText(file)
      } else {
        toast.error(t('Unsupported file type'))
        finish()
      }
    }
  }

  const captureFromStream = async (
    stream: MediaStream,
    name: string
  ): Promise<void> => {
    try {
      const video = document.createElement('video')
      video.srcObject = stream
      video.muted = true
      await video.play()
      await new Promise((resolve) => setTimeout(resolve, 250))
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720
      const context = canvas.getContext('2d')
      if (context) {
        context.drawImage(video, 0, 0)
        const dataUrl = canvas.toDataURL('image/png')
        onAddAttachments([{ name, dataUrl, kind: 'image' }])
        toast.success(t('Attachments added'))
      }
    } finally {
      stream.getTracks().forEach((track) => track.stop())
    }
  }

  const handleTakeScreenshot = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      })
      await captureFromStream(
        stream,
        `${t('Screenshot')}-${Date.now()}.png`
      )
    } catch {
      toast.error(t('Screenshot capture cancelled or failed'))
    }
  }

  const handleTakePhoto = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      })
      await captureFromStream(stream, `${t('Photo')}-${Date.now()}.png`)
    } catch {
      toast.error(t('Camera access cancelled or failed'))
    }
  }

  const handleFileAction = (action: string) => {
    if (action === 'take-screenshot') {
      void handleTakeScreenshot()
      return
    }
    if (action === 'take-photo') {
      void handleTakePhoto()
      return
    }
    // upload-file / upload-photo: 打开图片选择器（可多选）
    fileInputRef.current?.click()
  }

  const handleSearchAction = () => {
    onSearchChange(!searchEnabled)
    if (!searchEnabled) {
      toast.info(t('Web search enabled'))
    }
  }

  const handleClearMessages = () => {
    onClearMessages?.()
    setClearConfirmOpen(false)
    toast.success(t('Conversation cleared'))
  }

  return (
    <>
      <PromptInputTools className='bg-background/70 border-border/60 rounded-lg border p-1 shadow-xs'>
        <Tooltip>
          <DropdownMenu>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <PromptInputButton
                      aria-label={t('Attach')}
                      className='text-muted-foreground hover:text-foreground hover:bg-muted/70 font-medium'
                      disabled={disabled}
                      variant='ghost'
                    />
                  }
                >
                  <PaperclipIcon size={16} />
                </DropdownMenuTrigger>
              }
            />
            <TooltipContent>
              <p>{t('Attach')}</p>
            </TooltipContent>
            <DropdownMenuContent align='start'>
              {ATTACHMENT_ACTIONS.map(({ action, icon: Icon, label }) => (
                <DropdownMenuItem
                  key={action}
                  onClick={() => handleFileAction(action)}
                >
                  <Icon className='mr-2' size={16} />
                  {t(label)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <PromptInputButton
                aria-label={t('Search')}
                className={`${searchEnabled ? 'text-primary bg-muted/70' : 'text-muted-foreground'} hover:text-foreground hover:bg-muted/70 font-medium`}
                disabled={disabled}
                onClick={handleSearchAction}
                variant='ghost'
              >
                <GlobeIcon size={16} />
              </PromptInputButton>
            }
          />
          <TooltipContent>
            <p>{t('Search')}</p>
          </TooltipContent>
        </Tooltip>

        <PlaygroundParameterPanel
          config={config}
          disabled={disabled}
          onConfigChange={onConfigChange}
          onParameterEnabledChange={onParameterEnabledChange}
          parameterEnabled={parameterEnabled}
        />

        <Tooltip>
          <TooltipTrigger
            render={
              <PromptInputButton
                aria-label={t('Clear chat history')}
                className='text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-medium'
                disabled={disabled || !hasMessages || !onClearMessages}
                onClick={() => setClearConfirmOpen(true)}
                variant='ghost'
              >
                <Trash2Icon size={16} />
              </PromptInputButton>
            }
          />
          <TooltipContent>
            <p>{t('Clear chat history')}</p>
          </TooltipContent>
        </Tooltip>
      </PromptInputTools>

      <ConfirmDialog
        destructive
        desc={t(
          'All playground messages saved in this browser will be removed. This cannot be undone.'
        )}
        confirmText={t('Clear')}
        handleConfirm={handleClearMessages}
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        title={t('Clear chat history?')}
      />
      <input
        ref={fileInputRef}
        type='file'
        accept='image/*,.txt,.md,.markdown,.csv,.tsv,.log,.json,.py,.js,.mjs,.cjs,.ts,.tsx,.jsx,.go,.java,.c,.cpp,.h,.hpp,.cs,.rb,.php,.rs,.swift,.kt,.kts,.sql,.sh,.bash,.ps1,.html,.htm,.css,.scss,.xml,.yaml,.yml,.toml,.ini'
        multiple
        className='hidden'
        onChange={(event) => {
          readFilesAsAttachments(event.target.files)
          event.target.value = ''
        }}
      />
    </>
  )
}
