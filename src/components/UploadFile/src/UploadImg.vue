<template>
  <div class="upload-box">
    <el-upload
      :id="uuid"
      :accept="fileType.join(',')"
      :action="uploadUrl"
      :before-upload="beforeUpload"
      :class="['upload', drag ? 'no-border' : '']"
      :disabled="disabled"
      :drag="drag"
      :http-request="httpRequest"
      :multiple="false"
      :on-error="uploadError"
      :on-success="uploadSuccess"
      :show-file-list="false"
    >
      <template v-if="modelValue">
        <img :src="modelValue" class="upload-image" />
        <div class="upload-handle" @click.stop>
          <div v-if="!disabled" class="handle-icon" @click="editImg">
            <Icon icon="ep:edit" />
            <span v-if="showBtnText">{{ t('action.edit') }}</span>
          </div>
          <div class="handle-icon" @click="imagePreview(modelValue)">
            <Icon icon="ep:zoom-in" />
            <span v-if="showBtnText">{{ t('action.detail') }}</span>
          </div>
          <div v-if="showDelete && !disabled" class="handle-icon" @click="deleteImg">
            <Icon icon="ep:delete" />
            <span v-if="showBtnText">{{ t('action.del') }}</span>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="upload-empty">
          <slot name="empty">
            <Icon icon="ep:plus" />
            <!-- <span>请上传图片</span> -->
          </slot>
        </div>
      </template>
    </el-upload>
    <div class="el-upload__tip">
      <slot name="tip"></slot>
    </div>

    <!-- 选图后先裁剪（比例由 cropAspectRatio 决定），确认后再上传 -->
    <el-dialog
      v-model="cropVisible"
      :close-on-click-modal="false"
      :title="t('imageCrop.title')"
      append-to-body
      width="720px"
      @close="onCropDialogClose"
      @closed="releaseCropSource"
    >
      <div class="upload-crop">
        <CropperImage
          v-if="cropSrc"
          :options="cropOptions"
          :real-time-preview="false"
          :src="cropSrc"
          height="380px"
          @ready="onCropperReady"
        />
      </div>
      <div class="upload-crop__hint">{{ t('imageCrop.hint') }}</div>
      <template #footer>
        <el-button @click="finishCrop(null)">{{ t('common.cancel') }}</el-button>
        <el-button :loading="cropping" type="primary" @click="confirmCrop">
          {{ t('imageCrop.confirm') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import type { UploadProps } from 'element-plus'

import { generateUUID } from '@/utils'
import { propTypes } from '@/utils/propTypes'
import { createImageViewer } from '@/components/ImageViewer'
import { useUpload } from '@/components/UploadFile/src/useUpload'
import { CropperImage } from '@/components/Cropper'
import type { Cropper } from '@/components/Cropper/src/types'
import { compressImageFile, DEFAULT_IMAGE_MAX_SIZE, renameByType } from '@/utils/imageCompress'

defineOptions({ name: 'UploadImg' })

type FileTypes =
  | 'image/apng'
  | 'image/bmp'
  | 'image/gif'
  | 'image/jpeg'
  | 'image/pjpeg'
  | 'image/png'
  | 'image/svg+xml'
  | 'image/tiff'
  | 'image/webp'
  | 'image/x-icon'

// 接受父组件参数
const props = defineProps({
  modelValue: propTypes.string.def(''),
  drag: propTypes.bool.def(true), // 是否支持拖拽上传 ==> 非必传（默认为 true）
  disabled: propTypes.bool.def(false), // 是否禁用上传组件 ==> 非必传（默认为 false）
  fileSize: propTypes.number.def(5), // 图片大小限制 ==> 非必传（默认为 5M）
  compress: propTypes.bool.def(false), // 上传前压缩 ==> 非必传（默认为 false）
  compressMaxSize: propTypes.number.def(DEFAULT_IMAGE_MAX_SIZE), // 压缩最长边上限(px) ==> 非必传（默认为 1440）
  crop: propTypes.bool.def(false), // 选图后裁剪 ==> 非必传（默认为 false）
  cropAspectRatio: propTypes.number.def(1), // 裁剪框比例（宽/高） ==> 非必传（默认为 1）
  fileType: propTypes.array.def(['image/jpeg', 'image/png', 'image/gif']), // 图片类型限制 ==> 非必传（默认为 ["image/jpeg", "image/png", "image/gif"]）
  height: propTypes.string.def('150px'), // 组件高度 ==> 非必传（默认为 150px）
  width: propTypes.string.def('150px'), // 组件宽度 ==> 非必传（默认为 150px）
  borderradius: propTypes.string.def('8px'), // 组件边框圆角 ==> 非必传（默认为 8px）
  showDelete: propTypes.bool.def(true), // 是否显示删除按钮
  showBtnText: propTypes.bool.def(true), // 是否显示按钮文字
  directory: propTypes.string.def(undefined) // 上传目录 ==> 非必传（默认为 undefined）
})
const { t } = useI18n() // 国际化
const message = useMessage() // 消息弹窗
// 生成组件唯一id
const uuid = ref('id-' + generateUUID())
// 查看图片
const imagePreview = (imgUrl: string) => {
  createImageViewer({
    zIndex: 9999999,
    urlList: [imgUrl]
  })
}

const emit = defineEmits(['update:modelValue'])

const deleteImg = () => {
  emit('update:modelValue', '')
}

const { uploadUrl, httpRequest } = useUpload(props.directory)

const editImg = () => {
  const dom = document.querySelector(`#${uuid.value} .el-upload__input`)
  dom && dom.dispatchEvent(new MouseEvent('click'))
}

// ========== 选图后裁剪 ==========
const cropVisible = ref(false)
const cropSrc = ref('')
const cropping = ref(false)
const cropper = ref<Cropper>()
let cropFileName = ''
let cropResolve: ((file: File | null) => void) | null = null

const cropOptions = computed(() => ({
  aspectRatio: props.cropAspectRatio > 0 ? props.cropAspectRatio : 1,
  viewMode: 1,
  autoCropArea: 1
}))

/** 打开裁剪弹窗，返回用户确认后的文件（取消返回 null） */
const openCropDialog = (file: File): Promise<File | null> => {
  cropFileName = file.name
  cropper.value = undefined
  cropSrc.value = URL.createObjectURL(file)
  cropVisible.value = true
  return new Promise((resolve) => {
    cropResolve = resolve
  })
}

const onCropperReady = (instance: Cropper) => {
  cropper.value = instance
}

const releaseCropSource = () => {
  if (cropSrc.value) {
    URL.revokeObjectURL(cropSrc.value)
  }
  cropSrc.value = ''
  cropper.value = undefined
}

const finishCrop = (file: File | null) => {
  const resolve = cropResolve
  cropResolve = null
  cropVisible.value = false
  resolve?.(file)
}

/** 关闭弹窗（右上角/ESC）等同取消 */
const onCropDialogClose = () => {
  if (cropResolve) {
    finishCrop(null)
  }
}

const confirmCrop = () => {
  const instance = cropper.value
  if (!instance) {
    finishCrop(null)
    return
  }
  cropping.value = true
  try {
    const maxSize = props.compressMaxSize
    const canvas = instance.getCroppedCanvas({ maxWidth: maxSize, maxHeight: maxSize })
    canvas.toBlob(
      (blob) => {
        cropping.value = false
        if (!blob) {
          finishCrop(null)
          return
        }
        finishCrop(
          new File([blob], renameByType(cropFileName, 'image/jpeg'), {
            type: 'image/jpeg',
            lastModified: Date.now()
          })
        )
      },
      'image/jpeg',
      0.92
    )
  } catch {
    cropping.value = false
    finishCrop(null)
  }
}

const beforeUpload: UploadProps['beforeUpload'] = async (rawFile) => {
  // 先裁剪取景，再压缩瘦身，最后按结果做格式与体积校验
  let file = rawFile
  if (props.crop) {
    const cropped = await openCropDialog(rawFile)
    if (!cropped) {
      return false
    }
    file = cropped
  }
  const compressed = props.compress
    ? await compressImageFile(file, { maxSize: props.compressMaxSize })
    : file
  // 压缩后类型不在允许列表时（例如仅允许 PNG 的页面被转成 JPEG）回退原图校验
  const target = props.fileType.includes(compressed.type) ? compressed : file
  const imgSize = target.size / 1024 / 1024 < props.fileSize
  const imgType = props.fileType
  if (!imgType.includes(target.type as FileTypes))
    message.notifyWarning('上传图片不符合所需的格式！')
  if (!imgSize) message.notifyWarning(`上传图片大小不能超过 ${props.fileSize}M！`)
  if (!imgType.includes(target.type as FileTypes) || !imgSize) {
    return false
  }
  // 返回 File 时 el-upload 会用压缩后的文件继续上传
  return target === rawFile ? true : target
}

// 图片上传成功提示
const uploadSuccess: UploadProps['onSuccess'] = (res: any): void => {
  message.success('上传成功')
  emit('update:modelValue', res.data)
}

// 图片上传错误提示
const uploadError = () => {
  message.notifyError('图片上传失败，请您重新上传！')
}
</script>
<style lang="scss" scoped>
.is-error {
  .upload {
    :deep(.el-upload),
    :deep(.el-upload-dragger) {
      border: 1px dashed var(--el-color-danger) !important;

      &:hover {
        border-color: var(--el-color-primary) !important;
      }
    }
  }
}

:deep(.disabled) {
  .el-upload,
  .el-upload-dragger {
    cursor: not-allowed !important;
    background: var(--el-disabled-bg-color);
    border: 1px dashed var(--el-border-color-darker) !important;

    &:hover {
      border: 1px dashed var(--el-border-color-darker) !important;
    }
  }
}

.upload-box {
  .no-border {
    :deep(.el-upload) {
      border: none !important;
    }
  }

  :deep(.upload) {
    .el-upload {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: v-bind(width);
      height: v-bind(height);
      overflow: hidden;
      border: 1px dashed var(--el-border-color-darker);
      border-radius: v-bind(borderradius);
      transition: var(--el-transition-duration-fast);

      &:hover {
        border-color: var(--el-color-primary);

        .upload-handle {
          opacity: 1;
        }
      }

      .el-upload-dragger {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        padding: 0;
        overflow: hidden;
        background-color: transparent;
        border: 1px dashed var(--el-border-color-darker);
        border-radius: v-bind(borderradius);

        &:hover {
          border: 1px dashed var(--el-color-primary);
        }
      }

      .el-upload-dragger.is-dragover {
        background-color: var(--el-color-primary-light-9);
        border: 2px dashed var(--el-color-primary) !important;
      }

      .upload-image {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .upload-empty {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        line-height: 30px;
        color: var(--el-color-info);

        .el-icon {
          font-size: 28px;
          color: var(--el-text-color-secondary);
        }
      }

      .upload-handle {
        position: absolute;
        top: 0;
        right: 0;
        display: flex;
        width: 100%;
        height: 100%;
        cursor: pointer;
        background: rgb(0 0 0 / 60%);
        opacity: 0;
        box-sizing: border-box;
        transition: var(--el-transition-duration-fast);
        align-items: center;
        justify-content: center;

        .handle-icon {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 0 6%;
          color: aliceblue;

          .el-icon {
            margin-bottom: 40%;
            font-size: 130%;
            line-height: 130%;
          }

          span {
            font-size: 85%;
            line-height: 85%;
          }
        }
      }
    }
  }

  .el-upload__tip {
    line-height: 18px;
    text-align: center;
  }
}

.upload-crop {
  display: flex;
  justify-content: center;
  overflow: hidden;
  background: #f5f5f7;
  border-radius: 8px;
}

.upload-crop__hint {
  margin-top: 12px;
  font-size: 12px;
  line-height: 18px;
  color: var(--el-text-color-secondary);
}
</style>
