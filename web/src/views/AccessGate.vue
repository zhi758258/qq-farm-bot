<script setup lang="ts">
import axios from 'axios'
import { nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { markAccessGatePassed } from '@/utils/access-gate'

const INTEGER_RE = /^-?\d+$/

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const fetching = ref(true)
const question = ref('')
const challengeId = ref('')
const answer = ref('')
const error = ref('')
const answerInput = ref<HTMLElement | null>(null)

async function focusAnswer() {
  await nextTick()
  const root = answerInput.value
  const input = root && root.querySelector ? root.querySelector('input') : null
  if (input && typeof input.focus === 'function')
    input.focus()
}

function redirectAfterPass() {
  markAccessGatePassed()
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  if (redirect && redirect.startsWith('/') && !redirect.startsWith('//')) {
    router.replace(redirect)
    return
  }
  router.replace({ name: 'login' })
}

async function loadChallenge() {
  fetching.value = true
  error.value = ''
  try {
    const res = await axios.get('/api/access-gate/challenge', {
      timeout: 8000,
      withCredentials: true,
    })
    if (res.data?.passed) {
      redirectAfterPass()
      return
    }
    challengeId.value = res.data?.data?.id || ''
    question.value = res.data?.data?.question || ''
    answer.value = ''
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

async function handleSubmit() {
  if (loading.value)
    return
  if (!challengeId.value) {
    error.value = '验证已过期，请刷新'
    return
  }
  const raw = String(answer.value ?? '').trim()
  if (!raw) {
    error.value = '请输入答案'
    return
  }
  if (!INTEGER_RE.test(raw)) {
    error.value = '请输入整数答案'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const res = await axios.post('/api/access-gate/verify', {
      id: challengeId.value,
      answer: Number(raw),
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
          请完成随机加减法后进入网站
        </p>
      </div>

      <form class="login-form" @submit.prevent="handleSubmit">
        <div class="form-field">
          <label class="form-label">题目</label>
          <div class="question-box">
            {{ fetching ? '正在获取题目…' : (question || '请刷新重试') }}
          </div>
        </div>
        <div class="form-field">
          <label class="form-label">答案</label>
          <div ref="answerInput">
            <BaseInput
              v-model="answer"
              type="number"
              placeholder="请输入计算结果"
            />
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
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  background: color-mix(in srgb, var(--theme-primary) 10%, transparent);
  color: var(--theme-primary);
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
