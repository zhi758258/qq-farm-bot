<script setup lang="ts">
import axios from 'axios'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { markAccessGatePassed } from '@/utils/access-gate'

interface GateTile {
  id: string
  label: string
  glyph: string
}

const INTEGER_RE = /^-?\d+$/

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const fetching = ref(true)
const challengeType = ref('')
const prompt = ref('')
const question = ref('')
const challengeId = ref('')
const tiles = ref<GateTile[]>([])
const pieces = ref<GateTile[]>([])
const slotLabel = ref('')
const selected = ref<string[]>([])
const mathAnswer = ref('')
const slideValue = ref(0)
const slideTarget = ref(50)
const error = ref('')
const answerInput = ref<HTMLElement | null>(null)
const sliding = ref(false)
const droppedId = ref('')

const subtitle = computed(() => {
  if (challengeType.value === 'math')
    return '请完成随机加减法后进入网站'
  if (challengeType.value === 'slide')
    return '请将滑块拖到标记处后进入网站'
  if (challengeType.value === 'icon')
    return '请点击题目要求的图案文字后进入网站'
  if (challengeType.value === 'drag')
    return '请把指定图案拖到框内后进入网站'
  return '请完成访问验证后进入网站'
})

const droppedPiece = computed(() => pieces.value.find(item => item.id === droppedId.value) || null)
const remainingPieces = computed(() => pieces.value.filter(item => item.id !== droppedId.value))

function redirectAfterPass() {
  markAccessGatePassed()
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
    router.replace(redirect)
    return
  }
  router.replace({ name: 'login' })
}

async function focusAnswer() {
  await nextTick()
  const root = answerInput.value
  const input = root && root.querySelector ? root.querySelector('input') : null
  if (input && typeof input.focus === 'function')
    input.focus()
}

function toggleTile(id: string) {
  if (loading.value || fetching.value)
    return
  const index = selected.value.indexOf(id)
  if (index >= 0)
    selected.value = selected.value.filter(item => item !== id)
  else
    selected.value = [...selected.value, id]
  error.value = ''
}

function resetLocalState() {
  selected.value = []
  mathAnswer.value = ''
  slideValue.value = 0
  sliding.value = false
  droppedId.value = ''
}

function applyChallenge(data: any) {
  challengeId.value = data?.id || ''
  challengeType.value = data?.type || ''
  prompt.value = data?.prompt || ''
  question.value = data?.question || ''
  tiles.value = Array.isArray(data?.tiles) ? data.tiles : []
  pieces.value = Array.isArray(data?.pieces) ? data.pieces : []
  slotLabel.value = data?.slot?.label || ''
  slideTarget.value = Number(data?.target) || 50
  resetLocalState()
}

async function loadChallenge() {
  fetching.value = true
  error.value = ''
  resetLocalState()
  try {
    const res = await axios.get('/api/access-gate/challenge', {
      timeout: 8000,
      withCredentials: true,
    })
    if (res.data?.passed) {
      redirectAfterPass()
      return
    }
    applyChallenge(res.data?.data)
    if (challengeType.value === 'math')
      await focusAnswer()
  }
  catch (e: any) {
    if (e?.response?.status === 404) {
      router.replace({ name: 'not-found' })
      return
    }
    error.value = '无法获取验证题目，请刷新重试'
  }
  finally {
    fetching.value = false
  }
}

function currentAnswer() {
  if (challengeType.value === 'math') {
    const raw = String(mathAnswer.value ?? '').trim()
    if (!raw)
      return { error: '请输入答案' }
    if (!INTEGER_RE.test(raw))
      return { error: '请输入整数答案' }
    return { answer: Number(raw) }
  }
  if (challengeType.value === 'icon') {
    if (selected.value.length === 0)
      return { error: '请点击对应的图案文字' }
    return { answer: selected.value }
  }
  if (challengeType.value === 'slide') {
    if (!sliding.value)
      return { error: '请拖动滑块完成验证' }
    return { answer: Math.round(slideValue.value) }
  }
  if (challengeType.value === 'drag') {
    if (!droppedId.value)
      return { error: '请把指定图案拖到框内' }
    return { answer: droppedId.value }
  }
  return { error: '验证已过期，请刷新' }
}

async function handleSubmit() {
  if (loading.value)
    return
  if (!challengeId.value) {
    error.value = '验证已过期，请刷新'
    return
  }
  const payload = currentAnswer()
  if (payload.error) {
    error.value = payload.error
    return
  }
  loading.value = true
  error.value = ''
  try {
    const res = await axios.post('/api/access-gate/verify', {
      id: challengeId.value,
      answer: payload.answer,
    }, {
      timeout: 8000,
      withCredentials: true,
    })
    if (res.data?.ok) {
      redirectAfterPass()
      return
    }
    error.value = res.data?.error || '验证失败'
  }
  catch (e: any) {
    const status = e?.response?.status
    if (status === 404) {
      router.replace({ name: 'not-found' })
      return
    }
    error.value = e?.response?.data?.error || '验证失败，请刷新重试'
    if (status === 400)
      await loadChallenge()
  }
  finally {
    loading.value = false
  }
}

function onSlideInput() {
  sliding.value = true
  error.value = ''
}

function onPieceDragStart(event: DragEvent, id: string) {
  if (loading.value || fetching.value)
    return
  event.dataTransfer?.setData('text/plain', id)
  if (event.dataTransfer)
    event.dataTransfer.effectAllowed = 'move'
}

function onSlotDragOver(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer)
    event.dataTransfer.dropEffect = 'move'
}

function onSlotDrop(event: DragEvent) {
  event.preventDefault()
  const id = event.dataTransfer?.getData('text/plain') || ''
  if (!id || !pieces.value.some(item => item.id === id))
    return
  droppedId.value = id
  error.value = ''
}

function clearDropped() {
  if (loading.value || fetching.value)
    return
  droppedId.value = ''
}

onMounted(() => {
  loadChallenge()
})
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-logo">
        <div class="login-logo-icon">
          <div class="i-carbon-password text-3xl text-white" />
        </div>
        <h1 class="login-title">
          访问验证
        </h1>
        <p class="login-subtitle">
          {{ fetching ? '正在获取题目…' : subtitle }}
        </p>
      </div>

      <form class="login-form" @submit.prevent="handleSubmit">
        <div class="form-field">
          <label class="form-label">题目</label>
          <div class="question-box">
            {{ fetching ? '正在获取题目…' : (challengeType === 'math' ? question : (prompt || '请刷新重试')) }}
          </div>
        </div>

        <div v-if="challengeType === 'math'" class="form-field">
          <label class="form-label">答案</label>
          <div ref="answerInput">
            <BaseInput
              v-model="mathAnswer"
              type="number"
              placeholder="请输入计算结果"
            />
          </div>
        </div>

        <div v-else-if="challengeType === 'icon'" class="tile-grid">
          <button
            v-for="tile in tiles"
            :key="tile.id"
            type="button"
            class="tile"
            :class="{ selected: selected.includes(tile.id) }"
            :disabled="fetching || loading"
            @click="toggleTile(tile.id)"
          >
            <span class="tile-glyph">{{ tile.glyph }}</span>
            <span class="tile-label">{{ tile.label }}</span>
          </button>
        </div>

        <div v-else-if="challengeType === 'slide'" class="slide-wrap">
          <div class="slide-track">
            <div class="slide-mark" :style="{ left: `${slideTarget}%` }" />
            <input
              v-model.number="slideValue"
              class="slide-input"
              type="range"
              min="0"
              max="100"
              :disabled="fetching || loading"
              @input="onSlideInput"
            >
          </div>
          <div class="slide-hint">
            拖到绿色标记处后点击验证
          </div>
        </div>

        <div v-else-if="challengeType === 'drag'" class="drag-wrap">
          <div
            class="drop-slot"
            :class="{ filled: !!droppedPiece }"
            @dragover="onSlotDragOver"
            @drop="onSlotDrop"
            @click="clearDropped"
          >
            <template v-if="droppedPiece">
              <span class="tile-glyph">{{ droppedPiece.glyph }}</span>
              <span class="tile-label">{{ droppedPiece.label }}</span>
            </template>
            <span v-else class="drop-placeholder">拖到这里：{{ slotLabel }}</span>
          </div>
          <div class="drag-pieces">
            <button
              v-for="piece in remainingPieces"
              :key="piece.id"
              type="button"
              class="tile"
              draggable="true"
              :disabled="fetching || loading"
              @dragstart="onPieceDragStart($event, piece.id)"
            >
              <span class="tile-glyph">{{ piece.glyph }}</span>
              <span class="tile-label">{{ piece.label }}</span>
            </button>
          </div>
        </div>

        <div v-if="error" class="message error-message">
          {{ error }}
        </div>
        <BaseButton
          type="submit"
          variant="primary"
          block
          size="lg"
          :loading="loading"
          :disabled="fetching || loading"
        >
          验证
        </BaseButton>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #f0fdf4 100%);
  padding: 20px;
}

.dark .login-page {
  background: linear-gradient(135deg, #022c22 0%, #064e3b 50%, #022c22 100%);
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 40px 32px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 16px;
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.06),
    0 1px 4px rgba(0, 0, 0, 0.04);
  backdrop-filter: blur(12px);
}

.dark .login-card {
  background: rgba(30, 41, 59, 0.95);
  border-color: rgba(255, 255, 255, 0.06);
}

.login-logo {
  text-align: center;
  margin-bottom: 32px;
}

.login-logo-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: var(--theme-gradient);
  margin-bottom: 16px;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-primary) 25%, transparent);
}

.login-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--theme-primary);
  margin-bottom: 4px;
}

.login-subtitle {
  font-size: 0.875rem;
  opacity: 0.5;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  opacity: 0.6;
}

.question-box {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  font-size: 1.05rem;
  font-weight: 700;
  background: color-mix(in srgb, var(--theme-primary) 10%, transparent);
  color: var(--theme-primary);
  padding: 0 12px;
  text-align: center;
}

.tile-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 76px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;
}

.dark .tile {
  background: rgba(15, 23, 42, 0.55);
  border-color: rgba(255, 255, 255, 0.08);
}

.tile:hover:not(:disabled) {
  transform: translateY(-1px);
}

.tile.selected {
  border-color: var(--theme-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-primary) 28%, transparent);
}

.tile:disabled {
  opacity: 0.6;
  cursor: default;
}

.tile-glyph {
  font-size: 1.6rem;
  line-height: 1;
}

.tile-label {
  font-size: 0.75rem;
  font-weight: 600;
  opacity: 0.75;
}

.slide-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.slide-track {
  position: relative;
  height: 44px;
  display: flex;
  align-items: center;
}

.slide-mark {
  position: absolute;
  top: 8px;
  bottom: 8px;
  width: 4px;
  margin-left: -2px;
  border-radius: 999px;
  background: var(--theme-primary);
  pointer-events: none;
}

.slide-input {
  width: 100%;
  accent-color: var(--theme-primary);
}

.slide-hint {
  font-size: 0.75rem;
  opacity: 0.55;
  text-align: center;
}

.drag-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.drop-slot {
  min-height: 88px;
  border: 2px dashed color-mix(in srgb, var(--theme-primary) 45%, transparent);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: color-mix(in srgb, var(--theme-primary) 8%, transparent);
}

.drop-slot.filled {
  border-style: solid;
  cursor: pointer;
}

.drop-placeholder {
  font-size: 0.8125rem;
  font-weight: 600;
  opacity: 0.65;
}

.drag-pieces {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.message {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.8125rem;
  line-height: 1.4;
}

.error-message {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}
</style>
