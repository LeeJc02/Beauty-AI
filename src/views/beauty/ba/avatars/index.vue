<script setup lang="ts">
/**
 * 数字人顾客管理（原型 pages/BAAvatars.tsx，945 行）。
 *
 * 左侧是数字人列表，右侧是「基本信息与形象 / 角色标签 / 人格设定与剧本大纲」
 * 三块编辑区，外加「引用素材」和「对话预览」两个弹窗。
 */
import type { DerivedAssetReference, GoldenMaterial } from '@/beauty/types'
import { createDerivedAssetReferences } from '@/beauty/lib/materialLibraryData'
import EffectiveStatusBadge from '../components/EffectiveStatusBadge.vue'
import PracticePromptNotice from '../components/PracticePromptNotice.vue'
import MaterialReferenceDialog from '../components/MaterialReferenceDialog.vue'
import type { PlaygroundMessage } from '../components/types'

defineOptions({ name: 'BeautyBaAvatars' })

type AvatarLanguage = '中文' | '英文' | '印尼语'
type EffectiveStatus = 'pending' | 'active'
type TopicKey = '防晒' | '祛痘' | '底妆' | '通用'

interface Avatar {
  id: string
  name: string
  language: AvatarLanguage
  voice: string
  avatarUrl: string
  imageUrl: string
  tags: string[]
  prompt: string
  flow: string
  sourceReferences?: DerivedAssetReference[]
  effectiveStatus: EffectiveStatus
}

interface ScenarioScript {
  id: string
  title: string
  description: string
  outline: string
}

const AI_OUTLINE_BTN =
  '!h-9 !border-[#D8DEFF] !bg-[#EEF1FF] !text-[#515BCB] hover:!bg-[#E1E7FF] hover:!text-[#3F48B4]'
const NEUTRAL_OUTLINE_BTN = '!h-9 !border-[#E5DED8] !bg-white !text-[#3F3A3D] hover:!bg-[#F8F5F3]'
const AI_TONE_BTN =
  '!h-7 !border !border-[#D8DEFF] !bg-[#EEF1FF] !text-[#515BCB] hover:!bg-[#E1E7FF] hover:!text-[#3F48B4] shadow-sm'

const AVATAR_VOICE_OPTIONS: Record<AvatarLanguage, string[]> = {
  中文: ['中文女声 晓雅', '中文女声 晨曦', '中文男声 云泽'],
  英文: ['英文女声 Ava', '英文女声 Emma', '英文男声 Noah'],
  印尼语: ['印尼语女声 Sari', '印尼语女声 Dewi', '印尼语男声 Budi']
}

const MOCK_SCENARIO_SCRIPTS: ScenarioScript[] = [
  {
    id: 'sun-care',
    title: '通勤防晒咨询',
    description: '适合干皮通勤顾客，重点考察防晒质地、上妆兼容和试用引导。',
    outline:
      '1. 顾客询问有没有适合干皮的防晒推荐。\n2. 顾客担心产品会油腻、搓泥或影响底妆。\n3. BA 需要解释质地、使用顺序和适用肤质。\n4. 顾客要求试涂或询问小样，BA 完成试用引导。'
  },
  {
    id: 'acne-care',
    title: '油痘肌基础护理',
    description: '适合预算有限的年轻顾客，重点考察控油祛痘推荐和价格异议处理。',
    outline:
      '1. 顾客在祛痘产品区停留，对产品选择犹豫。\n2. 顾客说明油痘肌问题，并强调预算有限。\n3. BA 需要推荐入门组合，并解释使用顺序。\n4. 顾客提出价格顾虑，BA 给出单品优先级建议。'
  }
]

const containsAny = (text: string, keywords: string[]) =>
  keywords.some((keyword) => text.includes(keyword))

const detectTopic = (avatar: Avatar, script: ScenarioScript | null): TopicKey => {
  const source = `${avatar.prompt} ${avatar.flow} ${script?.title ?? ''} ${script?.description ?? ''}`
  if (containsAny(source, ['防晒', 'sunscreen', 'sun care', 'sun-care'])) return '防晒'
  if (containsAny(source, ['祛痘', '油痘', '痘', 'acne'])) return '祛痘'
  if (containsAny(source, ['底妆', '粉底', '搓泥', 'makeup', 'foundation', 'pilling']))
    return '底妆'
  return '通用'
}

const getOpeningLine = (avatar: Avatar, topic: TopicKey) => {
  const copy: Record<AvatarLanguage, Record<TopicKey, string>> = {
    中文: {
      防晒: '你好，我最近想找一款不油、不搓泥的防晒，最好适合通勤。',
      祛痘: '你好，我是油痘肌，想找一款能稳住状态的产品。',
      底妆: '你好，我想看看这款会不会和我的底妆冲突。',
      通用: '你好，我想先看看这款适不适合我。'
    },
    英文: {
      防晒: 'Hi, I am looking for a sunscreen that feels light and will not pill under makeup.',
      祛痘: 'Hi, I have oily acne-prone skin and want something that keeps my skin stable.',
      底妆: 'Hi, I want to see whether this will work with my makeup.',
      通用: 'Hi, I want to see whether this is a good fit for me.'
    },
    印尼语: {
      防晒: 'Halo, saya sedang cari sunscreen yang ringan, tidak lengket, dan tidak bikin makeup bergeser.',
      祛痘: 'Halo, saya punya kulit berminyak dan berjerawat, jadi saya cari produk yang bisa bantu menenangkan kulit.',
      底妆: 'Halo, saya mau lihat apakah produk ini cocok dipakai bareng makeup saya.',
      通用: 'Halo, saya ingin lihat apakah produk ini cocok untuk saya.'
    }
  }

  return copy[avatar.language][topic]
}

const getReplyLine = (avatar: Avatar, topic: TopicKey, input: string) => {
  const text = input.toLowerCase()
  const wantsSample = containsAny(text, ['试用', '小样', '试涂', 'sample', 'try', 'coba'])
  const worriesOil = containsAny(text, ['油', '油腻', 'oily', 'greasy', 'lengket'])
  const worriesMakeup = containsAny(text, ['搓泥', '底妆', 'makeup', 'foundation', 'pilling'])
  const worriesPrice = containsAny(text, ['价格', '预算', '贵', 'price', 'budget', 'mahal'])

  const replyMap: Record<
    AvatarLanguage,
    Record<'sample' | 'oil' | 'makeup' | 'price' | 'fallback', Record<TopicKey, string>>
  > = {
    中文: {
      sample: {
        防晒: '可以先试一下吗？我想看看上脸的感觉。',
        祛痘: '可以先试一点吗？我想看看会不会刺激。',
        底妆: '可以先试一下吗？我想看看会不会起皮。',
        通用: '可以先试一下吗？我想感受一下质地。'
      },
      oil: {
        防晒: '我最担心的就是太油，麻烦帮我挑轻一点的。',
        祛痘: '我最担心的是闷痘或者太厚重。',
        底妆: '我最担心它会不会又油又搓泥。',
        通用: '我比较在意清爽度，太油的我会犹豫。'
      },
      makeup: {
        防晒: '我平时会带妆，所以特别在意会不会搓泥。',
        祛痘: '我也会化妆，太厚的话会影响妆面。',
        底妆: '我平时底妆比较重，最怕叠加之后不服帖。',
        通用: '我会考虑和我平时的妆容搭不搭。'
      },
      price: {
        防晒: '如果价格太高，我可能会先再想想。',
        祛痘: '如果太贵的话，我可能会先选基础款。',
        底妆: '如果价格超出预算，我会考虑更平价的替代。',
        通用: '如果价格太高，我可能会再比较一下。'
      },
      fallback: {
        防晒: '听起来不错，不过我还想再确认一下使用感。',
        祛痘: '听起来可以，不过我还是想确认一下适不适合我。',
        底妆: '听起来不错，不过我还想再确认一下和底妆的兼容性。',
        通用: '听起来不错，不过我还想再确认一下细节。'
      }
    },
    英文: {
      sample: {
        防晒: 'Could I try a small amount first? I want to feel the texture.',
        祛痘: 'Could I try a little first? I want to see whether it feels too strong.',
        底妆: 'Could I try it first? I want to see whether it pills.',
        通用: 'Could I try a little first? I want to feel the texture.'
      },
      oil: {
        防晒: 'My biggest concern is that it feels too oily.',
        祛痘: 'My biggest concern is that it feels too heavy or may clog my skin.',
        底妆: 'My biggest concern is whether it becomes oily or pills.',
        通用: 'I care a lot about how lightweight it feels.'
      },
      makeup: {
        防晒: 'I wear makeup every day, so I care a lot about compatibility.',
        祛痘: 'I also wear makeup, so I need something that will not affect the finish.',
        底妆: 'I wear a fuller base, so I really care about layering.',
        通用: 'I need something that works with my usual makeup routine.'
      },
      price: {
        防晒: 'If it is too expensive, I may need to think about it first.',
        祛痘: 'If it is too expensive, I may start with a basic option.',
        底妆: 'If it goes over budget, I will consider a cheaper alternative.',
        通用: 'If it is too expensive, I may compare a few more options.'
      },
      fallback: {
        防晒: 'That sounds good, but I still want to confirm the feel.',
        祛痘: 'That sounds good, but I still want to confirm whether it suits me.',
        底妆: 'That sounds good, but I still want to confirm the makeup compatibility.',
        通用: 'That sounds good, but I still want to confirm a few details.'
      }
    },
    印尼语: {
      sample: {
        防晒: 'Boleh saya coba sedikit dulu? Saya ingin rasakan teksturnya.',
        祛痘: 'Boleh saya coba sedikit dulu? Saya ingin lihat apakah cocok untuk kulit saya.',
        底妆: 'Boleh saya coba dulu? Saya ingin lihat apakah hasilnya pilling.',
        通用: 'Boleh saya coba sedikit dulu? Saya ingin rasakan teksturnya.'
      },
      oil: {
        防晒: 'Yang paling saya khawatirkan itu terasa terlalu berminyak.',
        祛痘: 'Yang paling saya khawatirkan itu terlalu berat atau menyumbat kulit.',
        底妆: 'Yang paling saya khawatirkan itu jadi berminyak atau pilling.',
        通用: 'Saya paling peduli apakah teksturnya terasa ringan.'
      },
      makeup: {
        防晒: 'Saya pakai makeup setiap hari, jadi saya peduli apakah cocok dipakai bareng makeup.',
        祛痘: 'Saya juga pakai makeup, jadi saya butuh yang tidak mengganggu hasil akhirnya.',
        底妆: 'Saya pakai base yang cukup tebal, jadi saya peduli soal layering.',
        通用: 'Saya butuh produk yang cocok dengan rutinitas makeup saya.'
      },
      price: {
        防晒: 'Kalau terlalu mahal, saya mungkin perlu pertimbangkan dulu.',
        祛痘: 'Kalau terlalu mahal, saya mungkin mulai dari opsi yang lebih basic.',
        底妆: 'Kalau lewat budget, saya akan cari alternatif yang lebih murah.',
        通用: 'Kalau terlalu mahal, saya mungkin bandingkan beberapa opsi lagi.'
      },
      fallback: {
        防晒: 'Kedengarannya bagus, tapi saya masih ingin cek feel-nya.',
        祛痘: 'Kedengarannya bagus, tapi saya masih ingin cek apakah cocok untuk saya.',
        底妆: 'Kedengarannya bagus, tapi saya masih ingin cek kecocokan dengan makeup.',
        通用: 'Kedengarannya bagus, tapi saya masih ingin cek beberapa detail.'
      }
    }
  }

  if (wantsSample) return replyMap[avatar.language].sample[topic]
  if (worriesOil) return replyMap[avatar.language].oil[topic]
  if (worriesMakeup) return replyMap[avatar.language].makeup[topic]
  if (worriesPrice) return replyMap[avatar.language].price[topic]
  return replyMap[avatar.language].fallback[topic]
}

const INITIAL_AVATARS: Avatar[] = [
  {
    id: '1',
    name: '职场莉莉',
    language: '印尼语',
    voice: AVATAR_VOICE_OPTIONS['印尼语'][0],
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Lily&backgroundColor=ffdfbf',
    imageUrl: '',
    tags: ['25-30岁', '混干皮', '女性', '通勤防晒需求'],
    prompt:
      '你叫莉莉，是一名在雅加达CBD工作的白领。你平时工作很忙，经常对着电脑，皮肤容易干燥并且有肤色不均的问题。你现在想寻找一款既能保湿又能防晒，并且上妆不搓泥的妆前/防晒产品。你的态度比较直接，看重产品的效率和实际效果。',
    flow: '1. 进店询问有没有适合干皮的防晒推荐。\n2. 对BA推荐的产品提出质疑（比如“会不会很油？”或“跟我的粉底会不会搓泥？”）。\n3. 询问有没有小样可以试用，或者要求试涂在手上。\n4. 根据BA的解答专业度决定是否购买。',
    effectiveStatus: 'active'
  },
  {
    id: '2',
    name: '学生小雅',
    language: '印尼语',
    voice: AVATAR_VOICE_OPTIONS['印尼语'][1],
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Yaya&backgroundColor=c0aede',
    imageUrl: '',
    tags: ['18-22岁', '油痘肌', '女性', '预算有限'],
    prompt:
      '你是小雅，一名在读的大学生。你的皮肤是油痘肌，经常长痘痘和闭口，非常苦恼。你每月的护肤预算有限。你希望BA能推荐一些平价但有效祛痘、控油的产品。如果产品太贵，你会犹豫。',
    flow: '1. 在祛痘产品区徘徊，表现出不知所措。\n2. 告诉BA自己的痘痘问题，并强调自己是学生，可能买不起太贵的套盒。\n3. 询问除了护肤品，有没有什么日常护理的建议。\n4. 如果推荐的产品在预算内且听起来合理，会考虑购买单品。',
    effectiveStatus: 'active'
  },
  {
    id: '3',
    name: 'Karina',
    language: '印尼语',
    voice: AVATAR_VOICE_OPTIONS['印尼语'][0],
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Karina&backgroundColor=f4d7d7',
    imageUrl: '',
    tags: ['22 tahun', 'berminyak sensitif', 'jerawat berulang', 'AcnePlus'],
    prompt:
      'Anda berperan sebagai pelanggan digital bernama Karina, perempuan 22 tahun dengan kulit berminyak dan sensitif. Area T mudah berminyak, pipi cenderung kering dan kemerahan. Masalah utama Anda adalah jerawat berulang di dahi, dagu, dan garis rahang, bekas jerawat kemerahan, dan kadang jerawat bernanah. Anda pernah mencoba salicylic acid, azelaic acid, tea tree oil, dan antibiotik jangka pendek, tetapi hasilnya tidak stabil atau malah iritasi. Anda tertarik pada series Y.O.U AcnePlus karena ingin kulit lebih tenang sebelum interview penting dalam 2-3 minggu. Gaya bicara Anda hati-hati, skeptis, sudah banyak membaca soal ingredients, suka bertanya detail, dan kadang membandingkan dengan The Ordinary atau Paula’s Choice. Anda ingin BA menjelaskan keamanan, efektivitas, urutan pemakaian, waktu hasil terlihat, dan value for money. Jika jawaban BA jelas, Anda bertanya lebih dalam tentang interaksi ingredients dan pemakaian jangka panjang. Jika jawaban BA ragu atau salah, Anda mendesak 1-2 kali dengan sopan. Percakapan selesai hanya jika kekhawatiran inti terjawab dan Anda berkata bahwa Anda mau beli satu rangkaian untuk dicoba; jika tidak, Anda akan bilang ingin pikir-pikir dulu.',
    flow: '1. Perkenalkan kondisi kulit berminyak sensitif dan jerawat berulang, lalu tanya produk AcnePlus mana yang paling cocok.\n2. Saat BA menyebut manfaat produk, minta bukti atau penjelasan ingredients, termasuk keamanan untuk kulit sensitif.\n3. Bandingkan minimal sekali dengan The Ordinary Niacinamide 10% atau Paula’s Choice Salicylic Acid.\n4. Tanyakan skenario pemakaian pagi dan malam, apakah wajib sunscreen, dan kapan hasil realistis terlihat.\n5. Putuskan membeli hanya jika BA mampu menjawab keamanan, efektivitas, cara pakai, dan value for money.',
    effectiveStatus: 'active'
  },
  {
    id: '4',
    name: 'Raisa',
    language: '印尼语',
    voice: AVATAR_VOICE_OPTIONS['印尼语'][1],
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Raisa&backgroundColor=d6e7ff',
    imageUrl: '',
    tags: ['28 tahun', 'kombinasi berminyak', 'base makeup', 'shade match'],
    prompt:
      'Anda berperan sebagai pelanggan digital bernama Raisa, perempuan 28 tahun yang bekerja sebagai account executive dan sering bertemu klien dari pagi sampai sore. Anda mencari cushion atau foundation yang terlihat rapi di kamera, tahan lama, tidak mudah transfer ke masker, dan tidak membuat area T semakin berminyak. Kulit Anda kombinasi berminyak, pori-pori terlihat di hidung, ada sedikit bekas jerawat, dan undertone Anda cenderung neutral-olive sehingga sering salah pilih shade. Anda pernah kecewa karena foundation terlihat abu-abu setelah beberapa jam, oksidasi, atau cracking di sekitar hidung. Gaya bicara Anda praktis, teliti, dan cukup kritis soal klaim long-lasting. Anda akan menanyakan coverage, hasil akhir, shade, oksidasi, cara set dengan powder, keamanan untuk kulit acne-prone, dan perbedaan dengan Maybelline Fit Me atau Somethinc cushion. Jika BA hanya memberi klaim umum seperti tahan lama atau natural, Anda meminta contoh konkret dan cara pakai. Anda mau membeli jika BA bisa membantu shade matching, menjelaskan teknik aplikasi, dan memberi alasan kenapa produk itu cocok untuk rutinitas kerja Anda.',
    flow: '1. Datang mencari cushion atau foundation untuk kerja harian yang tahan lama dan tidak mudah transfer.\n2. Ceritakan masalah shade sering terlalu abu-abu atau oksidasi, lalu minta bantuan memilih undertone.\n3. Tanyakan coverage, finish, oil control, risiko clogging, dan cara set agar tidak cracking.\n4. Bandingkan dengan Maybelline Fit Me atau Somethinc cushion, terutama dari sisi ketahanan dan shade range.\n5. Minta dicoba di rahang atau pipi, tunggu sebentar untuk cek oksidasi, lalu putuskan berdasarkan penjelasan BA.',
    effectiveStatus: 'active'
  },
  {
    id: '5',
    name: 'Dinda',
    language: '印尼语',
    voice: AVATAR_VOICE_OPTIONS['印尼语'][0],
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dinda&backgroundColor=f9d5e5',
    imageUrl: '',
    tags: ['19 tahun', 'bibir kering', 'lip product', 'warna natural'],
    prompt:
      'Anda berperan sebagai pelanggan digital bernama Dinda, perempuan 19 tahun, mahasiswa yang ingin membeli lip tint atau lip cream untuk dipakai kuliah dan hangout. Bibir Anda mudah kering, sering mengelupas, dan warna bibir agak gelap di bagian pinggir, jadi Anda takut produk matte membuat bibir terlihat pecah-pecah atau makin gelap. Anda suka warna natural seperti peach brown, rose nude, atau mauve, tetapi ingin tetap terlihat fresh di foto. Budget Anda terbatas, jadi Anda sangat peduli apakah produk cukup worth it. Gaya bicara Anda ramah tetapi banyak ragu, sering bertanya apakah warnanya cocok untuk kulit sawo matang, apakah transferproof, apakah aman dipakai setiap hari, dan apakah perlu lip balm dulu. Anda akan membandingkan dengan Wardah, Implora, atau Maybelline SuperStay. Jika BA memaksa shade yang terlalu terang atau terlalu bold, Anda akan menolak halus dan minta alternatif yang lebih wearable. Anda akan membeli jika BA bisa menjelaskan tekstur, kenyamanan, ketahanan, cara pemakaian untuk bibir kering, dan membantu memilih warna yang tidak membuat wajah kusam.',
    flow: '1. Ceritakan bahwa Anda mencari lip tint atau lip cream untuk kuliah, tetapi bibir mudah kering dan pinggir bibir agak gelap.\n2. Tanyakan shade natural yang cocok untuk kulit sawo matang dan tidak membuat wajah terlihat kusam.\n3. Uji BA dengan pertanyaan soal transferproof, ketahanan setelah makan, kandungan pelembap, dan apakah perlu lip balm.\n4. Bandingkan dengan Wardah, Implora, atau Maybelline SuperStay dari sisi kenyamanan dan harga.\n5. Minta swatch dua warna paling wearable; beli hanya jika BA bisa memberi alasan shade dan cara pakai yang meyakinkan.',
    effectiveStatus: 'active'
  }
]

const avatars = ref<Avatar[]>(INITIAL_AVATARS)
const selectedId = ref<string>(INITIAL_AVATARS[0].id)
const tagInput = ref('')
const showToast = ref(false)
const toastMessage = ref('保存成功')
const flowMode = ref<'custom' | 'existing'>('custom')
const selectedScriptId = ref(MOCK_SCENARIO_SCRIPTS[0].id)
const previewOpen = ref(false)
const previewInput = ref('')
const previewMessages = ref<PlaygroundMessage[]>([])
const previewTyping = ref(false)
const materialReferenceOpen = ref(false)
let replyTimer: ReturnType<typeof setTimeout> | null = null
let toastTimer: ReturnType<typeof setTimeout> | null = null

const selectedAvatar = computed(
  () => avatars.value.find((avatar) => avatar.id === selectedId.value) || avatars.value[0]
)

const selectedScript = computed<ScenarioScript | null>(() => {
  if (flowMode.value !== 'existing') return null
  return (
    MOCK_SCENARIO_SCRIPTS.find((item) => item.id === selectedScriptId.value) ??
    MOCK_SCENARIO_SCRIPTS[0]
  )
})

const notify = (message: string, duration = 3000) => {
  toastMessage.value = message
  showToast.value = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (showToast.value = false), duration)
}

const handleUpdate = <K extends keyof Avatar>(field: K, value: Avatar[K]) => {
  avatars.value = avatars.value.map((avatar) =>
    avatar.id === selectedId.value
      ? ({ ...avatar, [field]: value, effectiveStatus: 'pending' } as Avatar)
      : avatar
  )
}

const handleLanguageChange = (language: AvatarLanguage) => {
  avatars.value = avatars.value.map((avatar) =>
    avatar.id === selectedId.value
      ? {
          ...avatar,
          language,
          voice: AVATAR_VOICE_OPTIONS[language][0],
          effectiveStatus: 'pending'
        }
      : avatar
  )
}

const handleAddTag = () => {
  const value = tagInput.value.trim()
  if (!value || !selectedAvatar.value) return
  if (!selectedAvatar.value.tags.includes(value)) {
    handleUpdate('tags', [...selectedAvatar.value.tags, value])
  }
  tagInput.value = ''
}

const handleRemoveTag = (tagToRemove: string) => {
  if (!selectedAvatar.value) return
  handleUpdate(
    'tags',
    selectedAvatar.value.tags.filter((tag) => tag !== tagToRemove)
  )
}

const handleSelectScript = (scriptId: string) => {
  const script = MOCK_SCENARIO_SCRIPTS.find((item) => item.id === scriptId)
  selectedScriptId.value = scriptId
  if (script) handleUpdate('flow', script.outline)
}

/** 从「自定义大纲」切到「选择场景剧本」时同步一次剧本大纲。 */
const selectExistingFlow = () => {
  flowMode.value = 'existing'
  handleSelectScript(selectedScriptId.value)
}

const handleAddNew = () => {
  const newAvatar: Avatar = {
    id: Date.now().toString(),
    name: '新数字人顾客',
    language: '印尼语',
    voice: AVATAR_VOICE_OPTIONS['印尼语'][0],
    avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}&backgroundColor=e2e8f0`,
    imageUrl: '',
    tags: ['新标签'],
    prompt: '在这里输入数字人的人格设定...',
    flow: '1. ...\n2. ...\n3. ...',
    effectiveStatus: 'pending'
  }
  avatars.value = [newAvatar, ...avatars.value]
  selectedId.value = newAvatar.id
}

const handleDelete = (id: string) => {
  const newAvatars = avatars.value.filter((avatar) => avatar.id !== id)
  avatars.value = newAvatars
  if (selectedId.value === id && newAvatars.length > 0) {
    selectedId.value = newAvatars[0].id
  } else if (newAvatars.length === 0) {
    selectedId.value = ''
  }
}

const handleSave = () => {
  avatars.value = avatars.value.map((avatar) =>
    avatar.id === selectedId.value
      ? { ...avatar, effectiveStatus: 'active' as EffectiveStatus }
      : avatar
  )
  notify('保存成功')
}

const applyMaterialReference = (materials: GoldenMaterial[]) => {
  if (!selectedAvatar.value) return
  const customerMaterial = materials[0]
  const methodMaterial = materials[1]
  const tags = Array.from(
    new Set([...selectedAvatar.value.tags, ...materials.flatMap((material) => material.tags)])
  ).slice(0, 8)
  const prompt = [
    `你是一位具有明确购买顾虑的美妆顾客。${customerMaterial.aiSummary ?? customerMaterial.summary}`,
    methodMaterial
      ? `在 BA 沟通时，重点观察对方是否能做到：${methodMaterial.aiSummary ?? methodMaterial.summary}`
      : '',
    '表达自然直接，优先追问真实肤感、使用场景和试用体验。'
  ]
    .filter(Boolean)
    .join('\n')
  const flow = materials
    .map((material, index) => `${index + 1}. ${material.aiSummary ?? material.summary}`)
    .join('\n')

  avatars.value = avatars.value.map((avatar) =>
    avatar.id === selectedId.value
      ? {
          ...avatar,
          tags,
          prompt,
          flow,
          sourceReferences: createDerivedAssetReferences('avatar', materials),
          effectiveStatus: 'pending'
        }
      : avatar
  )
  flowMode.value = 'custom'
  notify(`已引用 ${materials.length} 条黄金素材，生成可编辑草稿`, 2800)
}

const handleGenerateAvatarImage = () => {
  if (!selectedAvatar.value) return
  const seed = encodeURIComponent(
    `${selectedAvatar.value.name}-${selectedAvatar.value.language}-${selectedAvatar.value.voice}`
  )
  handleUpdate(
    'imageUrl',
    `https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=900&q=80&sig=${seed}`
  )
  notify('已生成配图', 2200)
}

const buildPreviewMessages = (
  avatar: Avatar,
  script: ScenarioScript | null
): PlaygroundMessage[] => {
  const topic = detectTopic(avatar, script)
  return [
    {
      id: `${avatar.id}-opening`,
      role: 'assistant',
      text: getOpeningLine(avatar, topic)
    }
  ]
}

const resetPreviewConversation = () => {
  if (replyTimer) {
    clearTimeout(replyTimer)
    replyTimer = null
  }
  if (!selectedAvatar.value) return
  previewMessages.value = buildPreviewMessages(selectedAvatar.value, selectedScript.value)
  previewInput.value = ''
  previewTyping.value = false
}

const sendPreviewMessage = () => {
  const text = previewInput.value.trim()
  if (!text || !selectedAvatar.value) return

  const avatar = selectedAvatar.value
  const topic = detectTopic(avatar, selectedScript.value)
  const reply = getReplyLine(avatar, topic, text)
  const userMessage: PlaygroundMessage = { id: `${Date.now()}-user`, role: 'user', text }

  if (replyTimer) clearTimeout(replyTimer)

  previewMessages.value = [...previewMessages.value, userMessage]
  previewInput.value = ''
  previewTyping.value = true

  replyTimer = setTimeout(() => {
    previewMessages.value = [
      ...previewMessages.value,
      { id: `${Date.now()}-assistant`, role: 'assistant', text: reply }
    ]
    previewTyping.value = false
    replyTimer = null
  }, 650)
}

watch(
  () => [
    previewOpen.value,
    selectedAvatar.value?.id,
    selectedAvatar.value?.language,
    selectedAvatar.value?.voice,
    flowMode.value,
    selectedScriptId.value
  ],
  () => {
    if (!previewOpen.value) return
    resetPreviewConversation()
  }
)

onBeforeUnmount(() => {
  if (replyTimer) clearTimeout(replyTimer)
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <div
    class="beauty-ba-page flex overflow-hidden rounded-xl border border-[#E5DED8] bg-[#F7F3F1] pt-2"
  >
    <!-- 左侧：数字人顾客列表 -->
    <div class="w-80 shrink-0 flex flex-col border-r border-[#E5DED8] bg-white">
      <div class="z-10 flex items-center justify-between border-b border-[#E9E4DF] bg-white p-4">
        <h2 class="font-bold tracking-tight text-[#242124]">数字人顾客 ({{ avatars.length }})</h2>
        <button
          type="button"
          class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-700"
          @click="handleAddNew"
        >
          <Icon icon="lucide:plus" :size="16" />
          <span>新建</span>
        </button>
      </div>

      <div class="flex-1 space-y-3 overflow-y-auto p-4">
        <div
          v-for="avatar in avatars"
          :key="avatar.id"
          class="group flex cursor-pointer items-center rounded-xl border-2 p-3 transition-all"
          :class="
            selectedId === avatar.id
              ? 'border-rose-600 bg-rose-50/50 shadow-sm'
              : 'border-transparent bg-[#F8F5F3] hover:border-[#E5DED8] hover:bg-[#F1ECE8]'
          "
          @click="selectedId = avatar.id"
        >
          <img
            :src="avatar.avatarUrl"
            :alt="avatar.name"
            class="h-12 w-12 shrink-0 rounded-full object-cover"
            :class="selectedId === avatar.id ? 'ring-2 ring-rose-200' : ''"
          />
          <div class="ml-3 min-w-0 flex-1">
            <div class="mb-1 flex items-center gap-2">
              <h3
                data-i18n-skip="true"
                class="truncate text-sm font-bold"
                :class="selectedId === avatar.id ? 'text-rose-950' : 'text-[#242124]'"
              >
                {{ avatar.name }}
              </h3>
            </div>
            <div class="mt-0.5 flex h-4 flex-wrap gap-1 overflow-hidden">
              <span
                v-for="(tag, i) in avatar.tags.slice(0, 2)"
                :key="i"
                data-i18n-skip="true"
                class="rounded border border-[#E5DED8] bg-white px-1.5 py-0.5 text-[9px] font-medium text-[#766F73]"
              >
                {{ tag }}
              </span>
              <span v-if="avatar.tags.length > 2" class="px-1 text-[9px] text-[#9A9396]"
                >+{{ avatar.tags.length - 2 }}</span
              >
            </div>
          </div>
          <button
            type="button"
            class="ml-2 rounded-md p-1.5 text-[#9A9396] transition-colors hover:bg-red-50 hover:text-red-500"
            :class="selectedId === avatar.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
            @click.stop="handleDelete(avatar.id)"
          >
            <Icon icon="lucide:trash-2" :size="16" />
          </button>
        </div>
        <div v-if="avatars.length === 0" class="py-10 text-center text-sm text-[#9A9396]">
          暂无数字人顾客，请点击右上角添加
        </div>
      </div>
    </div>

    <!-- 右侧：编辑选中数字人 -->
    <div class="relative flex-1 flex flex-col bg-[#F7F3F1]">
      <div
        v-if="showToast"
        class="beauty-toast-in absolute left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg bg-[#3B8F72] px-4 py-2 text-white shadow-lg"
      >
        <Icon icon="lucide:check-circle" :size="16" />
        <span class="text-sm font-bold">{{ toastMessage }}</span>
      </div>

      <template v-if="selectedAvatar">
        <div
          class="flex shrink-0 items-center justify-between border-b border-[#E5DED8] bg-white p-6"
        >
          <div>
            <h1 class="text-xl font-bold text-[#242124]">编辑数字人：{{ selectedAvatar.name }}</h1>
            <p class="mt-1 text-xs text-[#766F73]">
              配置角色外观、人格设定及互动流程以用于 BA 陪练
            </p>
          </div>
          <div class="flex items-center gap-3">
            <el-button :class="AI_OUTLINE_BTN" @click="materialReferenceOpen = true">
              <Icon icon="lucide:library-big" :size="16" class="mr-1.5" />
              <span>引用素材</span>
            </el-button>
            <el-button :class="NEUTRAL_OUTLINE_BTN" @click="previewOpen = true">
              <Icon icon="lucide:message-square" :size="16" class="mr-1.5" />
              <span>对话预览</span>
            </el-button>
            <button
              type="button"
              class="flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-rose-700"
              @click="handleSave"
            >
              <Icon icon="lucide:save" :size="16" />
              <span>保存配置</span>
            </button>
            <EffectiveStatusBadge :status="selectedAvatar.effectiveStatus" />
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-6 md:p-8">
          <div class="mx-auto max-w-4xl space-y-8">
            <PracticePromptNotice />

            <!-- 基本信息与形象 -->
            <div class="rounded-2xl border border-[#E9E4DF] bg-white p-6 shadow-sm">
              <h3 class="mb-6 flex items-center text-sm font-bold text-[#242124]">
                <Icon icon="lucide:user" :size="16" class="mr-2 text-rose-500" />
                基本信息与形象
              </h3>

              <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
                <div class="col-span-1">
                  <label class="mb-2 block text-xs font-bold text-[#766F73]">静态头像</label>
                  <div
                    class="group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[#E5DED8] bg-[#F8F5F3] p-4 transition-colors hover:bg-[#F1ECE8]"
                  >
                    <img
                      :src="selectedAvatar.avatarUrl"
                      alt="Avatar"
                      class="mb-3 h-24 w-24 rounded-full object-cover shadow-sm transition-opacity group-hover:opacity-50"
                    />
                    <div
                      class="absolute inset-0 flex flex-col items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <Icon icon="lucide:upload" :size="24" class="mb-1 text-rose-600" />
                      <span class="text-xs font-bold text-rose-600">更换头像</span>
                    </div>
                  </div>
                </div>

                <div class="col-span-1 md:col-span-2">
                  <div class="mb-2 flex items-center justify-between">
                    <label class="block text-xs font-bold text-[#766F73]">上传大图</label>
                    <el-button :class="AI_TONE_BTN" @click="handleGenerateAvatarImage">
                      <Icon icon="lucide:wand-2" :size="16" class="mr-1 text-[#6974E8]" />
                      <span>AI 一键生成配图</span>
                    </el-button>
                  </div>
                  <div
                    class="group relative flex h-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[#E5DED8] bg-[#F8F5F3] text-[#9A9396] transition-colors hover:bg-[#F1ECE8]"
                  >
                    <img
                      v-if="selectedAvatar.imageUrl"
                      :src="selectedAvatar.imageUrl"
                      alt="Generated cover"
                      class="absolute inset-0 h-full w-full object-cover"
                    />
                    <template v-else>
                      <Icon
                        icon="lucide:image"
                        :size="32"
                        class="mb-2 transition-colors group-hover:text-rose-500"
                      />
                      <span
                        class="mb-1 text-sm font-bold text-[#5D565A] transition-colors group-hover:text-rose-600"
                        >点击上传或拖拽大图至此</span
                      >
                      <span class="text-[10px]">建议上传横版人物大图，用于学员端角色封面</span>
                    </template>
                  </div>
                </div>
              </div>

              <div
                class="mt-6 grid max-w-4xl grid-cols-1 gap-4 border-t border-[#E9E4DF] pt-6 md:grid-cols-3"
              >
                <div>
                  <label class="mb-2 block text-xs font-bold text-[#766F73]">数字人名称</label>
                  <input
                    :value="selectedAvatar.name"
                    type="text"
                    class="w-full rounded-lg border border-[#E5DED8] px-4 py-2 text-sm font-medium transition-shadow focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    @input="handleUpdate('name', ($event.target as HTMLInputElement).value)"
                  />
                </div>
                <div>
                  <label class="mb-2 block text-xs font-bold text-[#766F73]">语种</label>
                  <el-select
                    :model-value="selectedAvatar.language"
                    class="w-full"
                    @change="handleLanguageChange($event as AvatarLanguage)"
                  >
                    <el-option label="中文" value="中文" />
                    <el-option label="英文" value="英文" />
                    <el-option label="印尼语" value="印尼语" />
                  </el-select>
                </div>
                <div>
                  <label class="mb-2 block text-xs font-bold text-[#766F73]">选择音色</label>
                  <el-select
                    :model-value="selectedAvatar.voice"
                    class="w-full"
                    @change="handleUpdate('voice', $event as string)"
                  >
                    <el-option
                      v-for="voice in AVATAR_VOICE_OPTIONS[selectedAvatar.language]"
                      :key="voice"
                      :label="voice"
                      :value="voice"
                    />
                  </el-select>
                </div>
              </div>
            </div>

            <!-- 角色标签 -->
            <div class="rounded-2xl border border-[#E9E4DF] bg-white p-6 shadow-sm">
              <h3 class="mb-4 flex items-center text-sm font-bold text-[#242124]">
                <Icon icon="lucide:tag" :size="16" class="mr-2 text-rose-500" />
                角色标签 (年龄、肤质、需求等)
              </h3>
              <div class="mb-3 flex flex-wrap gap-2">
                <span
                  v-for="(tag, i) in selectedAvatar.tags"
                  :key="i"
                  data-i18n-skip="true"
                  class="inline-flex items-center rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600"
                >
                  {{ tag }}
                  <button
                    type="button"
                    class="ml-1.5 hover:text-rose-800 focus:outline-none"
                    @click="handleRemoveTag(tag)"
                  >
                    &times;
                  </button>
                </span>
              </div>
              <input
                v-model="tagInput"
                type="text"
                placeholder="输入标签并按回车添加..."
                class="w-full max-w-sm rounded-lg border border-[#E5DED8] px-4 py-2 text-sm transition-shadow focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                @keydown.enter.prevent="handleAddTag"
              />
            </div>

            <!-- 人格设定与剧本大纲 -->
            <div
              class="grid grid-cols-1 gap-8 rounded-2xl border border-[#E9E4DF] bg-white p-6 shadow-sm lg:grid-cols-2"
            >
              <div>
                <h3 class="mb-2 flex items-center text-sm font-bold text-[#242124]">
                  <Icon icon="lucide:message-square" :size="16" class="mr-2 text-[#4F5FD5]" />
                  人格设定 Prompt
                </h3>
                <p class="mb-4 text-[10px] text-[#766F73]">设定性格、语气及背景，驱动大模型行为</p>
                <textarea
                  :value="selectedAvatar.prompt"
                  class="h-64 w-full resize-none rounded-xl border border-[#E5DED8] p-4 text-sm leading-relaxed focus:border-[#4F5FD5] focus:outline-none focus:ring-2 focus:ring-[#4F5FD5]/20"
                  @input="handleUpdate('prompt', ($event.target as HTMLTextAreaElement).value)"
                ></textarea>
              </div>

              <div>
                <h3 class="mb-2 flex items-center text-sm font-bold text-[#242124]">
                  <Icon icon="lucide:file-text" :size="16" class="mr-2 text-[#B9822B]" />
                  对话流程与剧本大纲
                </h3>
                <p class="mb-4 text-[10px] text-[#766F73]">
                  可以自定义剧本大纲，也可以从已有场景剧本中选择
                </p>
                <div class="mb-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    class="h-9 rounded-lg border text-xs font-bold transition-colors"
                    :class="
                      flowMode === 'custom'
                        ? 'border-[#C89543] bg-[#FFF7EA] text-[#8B621F]'
                        : 'border-[#E5DED8] text-[#766F73] hover:bg-[#F8F5F3]'
                    "
                    @click="flowMode = 'custom'"
                  >
                    自定义大纲
                  </button>
                  <button
                    type="button"
                    class="h-9 rounded-lg border text-xs font-bold transition-colors"
                    :class="
                      flowMode === 'existing'
                        ? 'border-[#C89543] bg-[#FFF7EA] text-[#8B621F]'
                        : 'border-[#E5DED8] text-[#766F73] hover:bg-[#F8F5F3]'
                    "
                    @click="selectExistingFlow"
                  >
                    选择场景剧本
                  </button>
                </div>
                <div
                  v-if="flowMode === 'existing'"
                  class="mb-3 rounded-xl border border-[#F2DEC0] bg-[#FFF7EA]/40 p-3"
                >
                  <label class="mb-2 block text-[10px] font-bold text-[#8B621F]"
                    >已有场景剧本</label
                  >
                  <select
                    :value="selectedScriptId"
                    class="h-9 w-full rounded-lg border border-[#E8CCA0] bg-white px-3 text-xs font-bold text-[#3F3A3D] focus:outline-none focus:ring-2 focus:ring-[#B9822B]/20"
                    @change="handleSelectScript(($event.target as HTMLSelectElement).value)"
                  >
                    <option
                      v-for="script in MOCK_SCENARIO_SCRIPTS"
                      :key="script.id"
                      :value="script.id"
                      data-i18n-skip="true"
                    >
                      {{ script.title }}
                    </option>
                  </select>
                  <p data-i18n-skip="true" class="mt-2 text-[10px] leading-relaxed text-[#766F73]">
                    {{ selectedScript?.description }}
                  </p>
                </div>
                <textarea
                  :value="selectedAvatar.flow"
                  class="h-40 w-full resize-none rounded-xl border border-[#E5DED8] p-4 text-sm leading-relaxed focus:border-[#B9822B] focus:outline-none focus:ring-2 focus:ring-[#B9822B]/20"
                  @input="handleUpdate('flow', ($event.target as HTMLTextAreaElement).value)"
                ></textarea>
              </div>
            </div>

            <!-- 来源素材 -->
            <section
              v-if="selectedAvatar.sourceReferences?.length"
              class="rounded-xl border border-[#D8DEFF] bg-[#F7F8FF] p-5"
            >
              <div class="flex items-center gap-2 text-sm font-bold text-[#515BCB]">
                <Icon icon="lucide:link-2" :size="16" />来源素材
              </div>
              <div class="mt-3 space-y-2">
                <div
                  v-for="source in selectedAvatar.sourceReferences"
                  :key="source.id"
                  class="rounded-lg border border-[#D8DEFF] bg-white px-3 py-2.5"
                >
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="text-sm font-bold text-[#3F3A3D]">{{ source.materialTitle }}</span>
                    <span class="text-[11px] text-[#766F73]"
                      >v{{ source.materialVersion }} · {{ source.materialScope }}</span
                    >
                  </div>
                  <div class="mt-1.5 text-xs text-[#766F73]">
                    证据
                    {{
                      source.evidenceRanges
                        .map(
                          (range) =>
                            `${Math.floor(range.startSec / 60)}:${String(range.startSec % 60).padStart(2, '0')} - ${Math.floor(range.endSec / 60)}:${String(range.endSec % 60).padStart(2, '0')}`
                        )
                        .join('，')
                    }}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </template>

      <div v-else class="flex flex-1 flex-col items-center justify-center text-[#9A9396]">
        <Icon icon="lucide:user" :size="64" class="mb-4 opacity-20" />
        <p class="font-medium text-[#766F73]">在左侧选择或创建一个数字人顾客</p>
      </div>

      <!-- 对话预览 -->
      <el-dialog
        v-model="previewOpen"
        class="beauty-avatar-preview-dialog"
        width="1120px"
        top="6vh"
        append-to-body
      >
        <template #header>
          <div class="text-lg font-bold text-[#242124]">对话预览</div>
        </template>

        <div
          class="grid h-[76vh] min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.9fr)]"
        >
          <div class="flex min-h-0 flex-col border-r border-[#E5DED8] bg-[#FDFBFA]">
            <div
              class="flex items-center justify-between border-b border-[#E5DED8] bg-white px-6 py-3"
            >
              <div class="text-xs font-bold uppercase tracking-wider text-[#9A9396]">聊天记录</div>
              <el-button
                size="small"
                class="!border-[#E5DED8] !bg-white !text-[#3F3A3D]"
                @click="resetPreviewConversation"
              >
                <Icon icon="lucide:rotate-ccw" :size="16" class="mr-1" />
                <span>重置对话</span>
              </el-button>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <div class="space-y-4">
                <div
                  v-for="message in previewMessages"
                  :key="message.id"
                  class="flex"
                  :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
                >
                  <div
                    class="flex max-w-[85%] items-end gap-3"
                    :class="message.role === 'user' ? 'flex-row-reverse' : ''"
                  >
                    <div
                      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      :class="
                        message.role === 'user'
                          ? 'bg-rose-600 text-white'
                          : 'border border-[#E5DED8] bg-white text-rose-600'
                      "
                    >
                      <Icon
                        :icon="message.role === 'user' ? 'lucide:user' : 'lucide:bot'"
                        :size="16"
                      />
                    </div>
                    <div
                      class="rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm"
                      :class="
                        message.role === 'user'
                          ? 'rounded-br-md bg-rose-600 text-white'
                          : 'rounded-bl-md border border-[#E5DED8] bg-white text-[#242124]'
                      "
                    >
                      <p data-i18n-skip="true" class="whitespace-pre-wrap">{{ message.text }}</p>
                    </div>
                  </div>
                </div>

                <div v-if="previewTyping" class="flex justify-start">
                  <div class="flex items-end gap-3">
                    <div
                      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#E5DED8] bg-white text-rose-600"
                    >
                      <Icon icon="lucide:bot" :size="16" />
                    </div>
                    <div
                      class="rounded-2xl rounded-bl-md border border-[#E5DED8] bg-white px-4 py-3 shadow-sm"
                    >
                      <div class="flex items-center gap-1.5">
                        <span
                          class="h-2 w-2 rounded-full bg-[#C9C1C4] animate-bounce [animation-delay:-0.2s]"
                        ></span>
                        <span
                          class="h-2 w-2 rounded-full bg-[#C9C1C4] animate-bounce [animation-delay:-0.1s]"
                        ></span>
                        <span class="h-2 w-2 rounded-full bg-[#C9C1C4] animate-bounce"></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="border-t border-[#E5DED8] bg-white p-4">
              <div class="flex items-end gap-3">
                <textarea
                  v-model="previewInput"
                  placeholder="输入消息..."
                  class="min-h-[56px] flex-1 resize-none rounded-lg border border-[#E5DED8] bg-white px-3 py-2 text-sm leading-relaxed outline-none transition-colors placeholder:text-[#9A9396] focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
                  @keydown.enter.exact.prevent="sendPreviewMessage"
                ></textarea>
                <button
                  type="button"
                  class="flex h-10 items-center gap-1.5 rounded-lg bg-rose-600 px-4 text-sm font-bold text-white transition-colors hover:bg-rose-700"
                  @click="sendPreviewMessage"
                >
                  <Icon icon="lucide:send" :size="16" />
                  <span>发送</span>
                </button>
              </div>
            </div>
          </div>

          <div class="min-h-0 overflow-y-auto bg-[#F8F5F3] px-5 py-5">
            <div class="space-y-5">
              <div class="flex items-center gap-3 border-b border-[#E5DED8] pb-4">
                <img
                  :src="selectedAvatar?.avatarUrl"
                  :alt="selectedAvatar?.name"
                  class="h-14 w-14 rounded-full object-cover shadow-sm"
                />
                <div class="min-w-0">
                  <div data-i18n-skip="true" class="truncate text-sm font-bold text-[#242124]">
                    {{ selectedAvatar?.name }}
                  </div>
                  <div class="truncate text-xs text-[#766F73]">
                    {{ selectedAvatar?.language }} · {{ selectedAvatar?.voice }}
                  </div>
                </div>
              </div>

              <div>
                <div class="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#9A9396]">
                  当前剧本
                </div>
                <div class="rounded-xl border border-[#E5DED8] bg-white p-3">
                  <div data-i18n-skip="true" class="text-sm font-bold text-[#242124]">
                    {{ selectedScript?.title ?? '自定义大纲' }}
                  </div>
                  <p data-i18n-skip="true" class="mt-1 text-xs leading-relaxed text-[#766F73]">
                    {{ selectedScript?.description ?? '使用当前数字人对话流程进行预览' }}
                  </p>
                </div>
              </div>

              <div>
                <div class="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#9A9396]">
                  人格设定 Prompt
                </div>
                <div
                  data-i18n-skip="true"
                  class="max-h-40 overflow-y-auto whitespace-pre-line rounded-xl border border-[#E5DED8] bg-white p-3 text-xs leading-relaxed text-[#5D565A]"
                >
                  {{ selectedAvatar?.prompt }}
                </div>
              </div>

              <div>
                <div class="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#9A9396]">
                  对话流程与剧本大纲
                </div>
                <div
                  data-i18n-skip="true"
                  class="max-h-40 overflow-y-auto whitespace-pre-line rounded-xl border border-[#E5DED8] bg-white p-3 text-xs leading-relaxed text-[#5D565A]"
                >
                  {{ selectedAvatar?.flow }}
                </div>
              </div>

              <div>
                <div class="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#9A9396]">
                  标签
                </div>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="tag in selectedAvatar?.tags ?? []"
                    :key="tag"
                    data-i18n-skip="true"
                    class="inline-flex items-center rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600"
                  >
                    {{ tag }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-dialog>

      <MaterialReferenceDialog
        v-model="materialReferenceOpen"
        target="avatar"
        @apply="applyMaterialReference"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.beauty-ba-page {
  height: calc(
    100dvh - var(--top-tool-height) - var(--tags-view-height) - var(--app-content-padding) *
      2 - var(--app-footer-height)
  );
  min-height: 560px;
}

.beauty-toast-in {
  animation: beauty-toast-in 0.2s ease-out both;
}

@keyframes beauty-toast-in {
  from {
    opacity: 0;
    transform: translate(-50%, -8px);
  }

  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

:global(.beauty-avatar-preview-dialog .el-dialog__header) {
  margin: 0;
  padding: 16px 24px;
  border-bottom: 1px solid #e5ded8;
  background: #fff;
}

:global(.beauty-avatar-preview-dialog .el-dialog__body) {
  padding: 0;
}

:global(.beauty-avatar-preview-dialog .el-dialog__footer) {
  padding: 0;
}
</style>
