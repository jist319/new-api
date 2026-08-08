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
import type {
  Message,
  OpenAIResponsesRequest,
  OpenAIResponsesResponse,
  PlaygroundConfig,
} from '../../types'
import { getMessageContent, isValidMessage } from '../message/message-utils'

/**
 * Build an OpenAI Responses request from playground messages with the
 * built-in web search tool enabled.
 */
export function buildResponsesPayload(
  messages: Message[],
  config: PlaygroundConfig
): OpenAIResponsesRequest {
  const input = messages
    .filter(isValidMessage)
    .map((message) => ({
      role: message.from,
      content: getMessageContent(message),
    }))

  return {
    model: config.model,
    input,
    tools: [{ type: 'web_search_preview' }],
    web_search_options: { search_context_size: 'medium' },
    stream: false,
  }
}

/**
 * Extract the assistant text from an OpenAI Responses response.
 */
export function extractResponsesText(
  response: OpenAIResponsesResponse
): string {
  const message = (response.output ?? []).find(
    (item) => item.type === 'message'
  )
  const text = (message?.content ?? [])
    .filter((part) => part.type === 'output_text')
    .map((part) => part.text ?? '')
    .join('')
  return text.trim()
}
