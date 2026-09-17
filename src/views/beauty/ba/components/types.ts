/** 对话预览消息（原型 components/ConversationPlaygroundDialog.tsx 导出）。 */
export interface PlaygroundMessage {
  id: string
  role: 'assistant' | 'user'
  text: string
}
