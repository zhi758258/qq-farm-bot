<script setup lang="ts">
import { computed } from 'vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'

const props = defineProps<{
  enabled: boolean
  restarting: boolean
  lastRestartAt: number
}>()

const emit = defineEmits<{
  restart: []
}>()

const statusText = computed(() => {
  if (!props.enabled)
    return '未启用'
  if (props.restarting)
    return '正在重启'
  return '已就绪'
})

const lastRestartText = computed(() => {
  if (!props.lastRestartAt)
    return '尚未手动重启'
  return new Date(props.lastRestartAt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
})

function onToggle(value: boolean | undefined) {
  if (value !== true)
    return
  emit('restart')
}
</script>

<template>
  <div class="border border-gray-200 rounded-xl bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 class="flex items-center gap-2 text-base text-gray-900 font-bold dark:text-gray-100">
          <div class="i-carbon-restart" />
          NapCat 重启
        </h3>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          仅重启 NapCat 并清理其日志，农场 Bot 保持运行，已登录账号不会掉线。
        </p>
      </div>
      <BaseSwitch
        :model-value="restarting"
        :disabled="!enabled || restarting"
        label="重启 NapCat"
        @update:model-value="onToggle"
      />
    </div>

    <div class="grid gap-3 md:grid-cols-2">
      <div class="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:bg-gray-900/40 dark:text-gray-200">
        <div class="text-xs text-gray-500 dark:text-gray-400">
          当前状态
        </div>
        <div class="mt-1 font-semibold">
          {{ statusText }}
        </div>
      </div>
      <div class="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:bg-gray-900/40 dark:text-gray-200">
        <div class="text-xs text-gray-500 dark:text-gray-400">
          最近重启
        </div>
        <div class="mt-1 font-semibold">
          {{ lastRestartText }}
        </div>
      </div>
    </div>
  </div>
</template>
