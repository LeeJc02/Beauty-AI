<script setup lang="ts">
/**
 * 素材库音频小播放器（原型 MaterialLibrary.tsx 里的 AudioMiniPlayer）。
 */
import type { MediaAsset } from '@/beauty/types'

defineOptions({ name: 'BeautyMaterialAudioPlayer' })

const props = defineProps<{ asset: MediaAsset; active: boolean }>()

const emit = defineEmits<{ (e: 'active-change', assetId: string | null): void }>()

/** 原型里的演示音频（SoundHelix 公共示例音源）。 */
const MOCK_AUDIO_PLAYBACK_URL = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'

const audioRef = ref<HTMLAudioElement | null>(null)
const isReady = ref(false)
const sourceCurrentTime = ref(0)
const isPlaying = ref(false)

watch(
  () => props.active,
  (active) => {
    if (active) return
    audioRef.value?.pause()
    isPlaying.value = false
  }
)

const displayedCurrentTime = computed(() =>
  Math.min(sourceCurrentTime.value, props.asset.durationSec)
)
const progress = computed(() => (displayedCurrentTime.value / props.asset.durationSec) * 100)

const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

const togglePlayback = async () => {
  const audio = audioRef.value
  if (!audio) return
  if (isPlaying.value) {
    audio.pause()
    return
  }
  emit('active-change', props.asset.id)
  try {
    await audio.play()
    isPlaying.value = true
  } catch {
    isPlaying.value = false
    emit('active-change', null)
  }
}

const seek = (value: number) => {
  const audio = audioRef.value
  if (!audio || !isReady.value) return
  const nextTime = (value / 100) * props.asset.durationSec
  audio.currentTime = nextTime
  sourceCurrentTime.value = nextTime
}

const onTimeUpdate = (event: Event) => {
  const audio = event.currentTarget as HTMLAudioElement
  if (audio.currentTime >= props.asset.durationSec) {
    audio.pause()
    audio.currentTime = 0
    sourceCurrentTime.value = 0
    emit('active-change', null)
    return
  }
  sourceCurrentTime.value = audio.currentTime
}

const onEnded = () => {
  sourceCurrentTime.value = 0
  emit('active-change', null)
}

const onError = () => {
  isPlaying.value = false
  emit('active-change', null)
}
</script>

<template>
  <div class="w-full shrink-0 rounded-lg border border-[#E5DED8] bg-[#FCFAF8] p-3 sm:w-52 lg:w-56">
    <audio
      ref="audioRef"
      preload="metadata"
      :src="MOCK_AUDIO_PLAYBACK_URL"
      @loadedmetadata="isReady = true"
      @timeupdate="onTimeUpdate"
      @play="isPlaying = true"
      @pause="isPlaying = false"
      @ended="onEnded"
      @error="onError"
    ></audio>
    <div class="flex items-center gap-3">
      <button
        type="button"
        :aria-label="`${isPlaying ? '暂停' : '播放'} ${asset.productOrScenario} 音频`"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#515BCB] text-white transition-colors hover:bg-[#444DB2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#515BCB]"
        @click="togglePlayback"
      >
        <Icon
          :icon="isPlaying ? 'lucide:pause' : 'lucide:play'"
          :size="16"
          :class="isPlaying ? 'fill-current' : 'ml-0.5 fill-current'"
        />
      </button>
      <div class="min-w-0 flex-1">
        <div class="truncate text-xs font-bold text-[#3F3A3D]">音频试听</div>
        <div class="mt-0.5 text-[11px] text-[#9A9396]">
          {{ formatDuration(Math.round(displayedCurrentTime)) }} /
          {{ formatDuration(asset.durationSec) }}
        </div>
      </div>
    </div>
    <label class="mt-3 block">
      <span class="sr-only">调整试听进度</span>
      <input
        type="range"
        min="0"
        max="100"
        step="0.1"
        :value="progress"
        :disabled="!isReady"
        :aria-label="`调整 ${asset.productOrScenario} 音频试听进度`"
        class="h-1.5 w-full cursor-pointer accent-[#515BCB] disabled:cursor-not-allowed disabled:opacity-45"
        @input="seek(Number(($event.target as HTMLInputElement).value))"
      />
    </label>
  </div>
</template>
