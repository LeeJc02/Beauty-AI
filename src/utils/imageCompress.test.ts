/**
 * 上传前图片压缩工具的行为检查（纯计算部分 + 不可压缩格式短路）。
 *
 * 运行：pnpm vitest run src/utils/imageCompress.test.ts
 */
import { describe, expect, it } from 'vitest'

import { compressImageFile, fitSize, isCompressibleImage, renameByType } from './imageCompress'

describe('fitSize', () => {
  it('横图按最长边等比缩放', () => {
    expect(fitSize(4000, 3000, 1440)).toEqual({ width: 1440, height: 1080, scale: 0.36 })
  })

  it('竖图按最长边等比缩放', () => {
    expect(fitSize(3000, 4000, 1440)).toEqual({ width: 1080, height: 1440, scale: 0.36 })
  })

  it('未超限时不放大', () => {
    expect(fitSize(800, 600, 1440)).toEqual({ width: 800, height: 600, scale: 1 })
  })

  it('形状非法时原样返回', () => {
    expect(fitSize(0, 0, 1440)).toEqual({ width: 0, height: 0, scale: 1 })
  })
})

describe('renameByType', () => {
  it('转 JPEG 时改写扩展名', () => {
    expect(renameByType('IMG_0001.PNG', 'image/jpeg')).toBe('IMG_0001.jpg')
  })

  it('保留原扩展名以外的点号', () => {
    expect(renameByType('ba.example.png', 'image/png')).toBe('ba.example.png')
  })

  it('无扩展名时补全', () => {
    expect(renameByType('example', 'image/webp')).toBe('example.webp')
  })
})

describe('isCompressibleImage', () => {
  it('仅对可重编码的位图格式返回 true', () => {
    expect(isCompressibleImage('image/jpeg')).toBe(true)
    expect(isCompressibleImage('image/png')).toBe(true)
    expect(isCompressibleImage('image/gif')).toBe(false)
    expect(isCompressibleImage('image/svg+xml')).toBe(false)
  })
})

describe('compressImageFile', () => {
  it('动图不做重编码，原样返回', async () => {
    const gif = new File([new Uint8Array([0x47, 0x49, 0x46])], 'anim.gif', { type: 'image/gif' })
    expect(await compressImageFile(gif)).toBe(gif)
  })

  it('矢量图不做重编码，原样返回', async () => {
    const svg = new File(['<svg/>'], 'icon.svg', { type: 'image/svg+xml' })
    expect(await compressImageFile(svg)).toBe(svg)
  })
})
