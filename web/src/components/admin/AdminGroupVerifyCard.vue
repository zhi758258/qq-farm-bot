<script setup lang="ts">
import type { GroupVerifyConfig, GroupVerifyTestResult } from '@/composables/useAdminSystemConfig'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'

withDefaults(defineProps<{
  loading: boolean
  saving: boolean
  testing: boolean
  testQq: string
  testResult: GroupVerifyTestResult | null
}>(), {})

const emit = defineEmits<{
  save: []
  test: []
}>()

const config = defineModel<GroupVerifyConfig>('config', { required: true })
const testQqModel = defineModel<string>('testQq')

const ERROR_LABELS: Record<string, string> = {
  not_configured: '未配置验证接口地址',
  no_qq: '缺少QQ号',
  service_unavailable: '验证服务不可达或响应异常',
  invalid_response: '接口返回内容不是有效JSON',
  not_in_group: '该QQ不在群内',
}

function errorLabel(result: GroupVerifyTestResult) {
  return result.errorMessage || ERROR_LABELS[result.error] || result.error || '未知错误'
}

function responsePreview(result: GroupVerifyTestResult) {
  try {
    return JSON.stringify(result.responseBody).slice(0, 300)
  }
  catch {
    return String(result.responseBody ?? '').slice(0, 300)
  }
}
</script>

<template>
  <div class="border border-gray-200 rounded-xl bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 class="flex items-center gap-2 text-base text-gray-900 font-bold dark:text-gray-100">
          <div class="i-carbon-group" />
          QQ群验证
        </h3>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          启用后，普通用户登录时会通过群机器人接口校验其注册的QQ号是否已加入群，未加群则拒绝登录。
        </p>
      </div>
      <BaseButton
        size="sm"
        :loading="saving"
        :disabled="loading"
        @click="emit('save')"
      >
        保存配置
      </BaseButton>
    </div>

    <div v-if="loading" class="py-4 text-center text-gray-500">
      <div class="i-svg-spinners-ring-resize mx-auto mb-2 text-2xl" />
      <p>加载中...</p>
    </div>

    <div v-else class="space-y-3">
      <BaseSwitch
        v-model="config.enabled"
        label="启用QQ群验证"
      />

      <div class="rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
        启用前请确认：注册页已要求填写QQ号；未配置验证接口或接口异常时，普通用户将无法登录（管理员不受影响）。
      </div>

      <div class="grid gap-3 md:grid-cols-2">
        <BaseInput
          v-model="config.qqGroupNumber"
          label="QQ群号"
          type="text"
          placeholder="例如 123456789"
        />
        <BaseInput
          v-model="config.timeoutMs"
          label="验证超时(毫秒)"
          type="number"
          placeholder="5000"
        />
      </div>
      <BaseInput
        v-model="config.verifyUrl"
        label="群机器人验证接口地址"
        type="text"
        placeholder="http://bot-host/api/check-group-member"
      />
      <BaseInput
        v-model="config.verifyToken"
        label="验证 Token（可留空）"
        type="password"
        placeholder="留空表示无需鉴权"
      />

      <div class="rounded-2xl bg-gray-50 px-4 py-3 text-xs text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
        接口约定：GET 请求，自动附加 <code>qq</code> 与 <code>group</code> 参数；鉴权通过请求头
        <code>Authorization: Bearer &lt;Token&gt;</code>。返回 <code>{"{"} ok: true, data: {"{"} inGroup: true {"}"} {"}"}</code>
        或 <code>{"{"} inGroup: true {"}"}</code> 表示在群内。
      </div>

      <div class="border border-gray-200 rounded-2xl p-3 dark:border-gray-700">
        <p class="mb-2 text-xs text-gray-700 font-semibold dark:text-gray-300">
          连接测试
        </p>
        <p class="mb-2 text-xs text-gray-500 dark:text-gray-400">
          填写一个用于测试的QQ号（建议先用一个已在群内的QQ），将按当前已保存的配置真实请求机器人接口。修改后需先保存再测试。
        </p>
        <div class="flex flex-col gap-2 sm:flex-row">
          <BaseInput
            v-model="testQqModel"
            class="flex-1"
            type="text"
            placeholder="测试用QQ号，例如 10001"
            @keyup.enter="emit('test')"
          />
          <BaseButton
            size="sm"
            class="sm:self-start"
            :loading="testing"
            :disabled="loading || saving"
            @click="emit('test')"
          >
            测试连接
          </BaseButton>
        </div>

        <div
          v-if="testResult"
          class="mt-3 rounded-xl px-3 py-2 text-xs"
          :class="testResult.inGroup
            ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200'
            : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200'"
        >
          <p class="font-semibold">
            {{ testResult.inGroup
              ? `测试通过：QQ ${testResult.qq} 在群${testResult.qqGroupNumber ? ` ${testResult.qqGroupNumber}` : ''}内`
              : `测试未通过：${errorLabel(testResult)}` }}
          </p>
          <p class="mt-1 opacity-80">
            HTTP 状态：{{ testResult.httpStatus ?? '-' }}
            <template v-if="testResult.durationMs != null">
              ｜耗时：{{ testResult.durationMs }}ms
            </template>
            <template v-if="testResult.qqGroupNumber && !testResult.inGroup">
              ｜测试群号：{{ testResult.qqGroupNumber }}
            </template>
          </p>
          <p v-if="testResult.requestUrl" class="mt-1 break-all opacity-70">
            请求：{{ testResult.requestUrl }}
          </p>
          <p
            v-if="testResult.responseBody != null && !testResult.inGroup"
            class="mt-1 break-all opacity-70"
          >
            响应：{{ responsePreview(testResult) }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
