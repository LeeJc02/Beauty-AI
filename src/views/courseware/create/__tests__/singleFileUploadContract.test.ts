import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('courseware upload single-file contract', () => {
  const source = readFileSync(resolve(__dirname, '../index.vue'), 'utf8')

  it('limits the visible uploader and disables multi-file selection', () => {
    expect(source).toContain(':limit="1"')
    expect(source).toContain(':multiple="false"')
    expect(source).toContain(':on-exceed="handleUploadExceeded"')
    expect(source).toContain(':disabled="uploadItems.length > 0"')
    expect(source).toContain('v-if="uploadItems.length > 0"')
    expect(source).toMatch(/v-else\s+class="courseware-upload-placeholder/)
    expect(source.match(/<el-upload\s/g)).toHaveLength(1)
  })

  it('guards resume selection while another upload item exists', () => {
    expect(source).toContain('if (uploadItems.value.length > 0) {\n    message.warning')
    expect(source).toContain('v-if="uploadItems.length === 0 && recoverableUploadTasks.length > 0"')
  })
})
