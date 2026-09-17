/**
 * 上传前图片压缩：等比缩放到最长边上限后重新编码，减少后台存储与 App 加载体积。
 *
 * 说明：
 * - 只在浏览器环境生效；GIF（动图）与 SVG（矢量）等无法用 canvas 安全重编码的格式原样返回；
 * - PNG 先按像素抽样判断是否含透明像素：含透明保持 PNG，不含透明转 JPEG（照片类体积收益最大）；
 * - 压缩结果不小于原文件时返回原文件，避免"越压越大"；
 * - 解码或编码失败一律回退原文件，不阻断上传。
 */

export interface ImageCompressOptions {
  /** 最长边上限（px），默认 1440 */
  maxSize?: number
  /** 编码质量（JPEG/WebP 生效），默认 0.85 */
  quality?: number
  /** 原图小于该体积且尺寸未超限时跳过重编码（KB），默认 300 */
  skipBelowKB?: number
}

export interface FittedSize {
  width: number
  height: number
  /** 缩放系数，1 表示未超限 */
  scale: number
}

/** 默认最长边上限，与后台示例图上传提示保持一致 */
export const DEFAULT_IMAGE_MAX_SIZE = 1440

/** 可用 canvas 重编码的入参类型 */
const COMPRESSIBLE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp']

export const isCompressibleImage = (type: string): boolean => COMPRESSIBLE_TYPES.includes(type)

/**
 * 等比缩放到 maxSize 以内（不放大）。
 */
export const fitSize = (width: number, height: number, maxSize: number): FittedSize => {
  if (!width || !height || !maxSize) {
    return { width, height, scale: 1 }
  }
  const scale = Math.min(1, maxSize / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale
  }
}

/** 按输出类型改写扩展名（jpg/jpeg/png/webp） */
export const renameByType = (name: string, type: string): string => {
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
  const base = (name || 'image').replace(/\.[^./\\]+$/, '')
  return `${base || 'image'}.${ext}`
}

interface DecodedImage {
  source: CanvasImageSource
  width: number
  height: number
  release: () => void
}

const decodeImage = async (file: File): Promise<DecodedImage | null> => {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close?.()
      }
    } catch {
      // 落到 <img> 兜底（部分浏览器对 image/* 之外的 blob 会拒绝）
    }
  }
  if (typeof Image === 'undefined') {
    return null
  }
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('image decode failed'))
      img.src = url
    })
    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      release: () => URL.revokeObjectURL(url)
    }
  } catch {
    URL.revokeObjectURL(url)
    return null
  }
}

/** 抽样检测透明像素：步长 4，避免大图逐像素扫描 */
const hasTransparency = (context: CanvasRenderingContext2D, width: number, height: number): boolean => {
  try {
    const { data } = context.getImageData(0, 0, width, height)
    for (let index = 3; index < data.length; index += 4 * 4) {
      if (data[index] < 250) {
        return true
      }
    }
  } catch {
    // 跨域等安全限制下读取失败，按不透明处理
  }
  return false
}

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => {
    if (typeof canvas.toBlob !== 'function') {
      resolve(null)
      return
    }
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })

/**
 * 压缩图片文件；无法处理或压缩无收益时返回原文件。
 */
export const compressImageFile = async (
  file: File,
  options: ImageCompressOptions = {}
): Promise<File> => {
  const maxSize = options.maxSize ?? DEFAULT_IMAGE_MAX_SIZE
  const quality = options.quality ?? 0.85
  const skipBelowKB = options.skipBelowKB ?? 300
  if (!file || !isCompressibleImage(file.type)) {
    return file
  }
  try {
    const decoded = await decodeImage(file)
    if (!decoded) {
      return file
    }
    try {
      const target = fitSize(decoded.width, decoded.height, maxSize)
      const withinLimits = target.scale >= 1
      if (withinLimits && file.size <= skipBelowKB * 1024) {
        return file
      }
      const canvas = document.createElement('canvas')
      canvas.width = target.width
      canvas.height = target.height
      const context = canvas.getContext('2d')
      if (!context) {
        return file
      }
      context.drawImage(decoded.source, 0, 0, target.width, target.height)
      const outputType =
        file.type === 'image/png' && hasTransparency(context, target.width, target.height)
          ? 'image/png'
          : 'image/jpeg'
      if (outputType === 'image/jpeg') {
        // canvas 默认透明底，转 JPEG 前先铺白底，避免透明区域变黑
        context.globalCompositeOperation = 'destination-over'
        context.fillStyle = '#FFFFFF'
        context.fillRect(0, 0, target.width, target.height)
        context.globalCompositeOperation = 'source-over'
      }
      const blob = await canvasToBlob(canvas, outputType, quality)
      if (!blob || blob.size >= file.size) {
        return file
      }
      return new File([blob], renameByType(file.name, outputType), {
        type: outputType,
        lastModified: Date.now()
      })
    } finally {
      decoded.release()
    }
  } catch {
    return file
  }
}
