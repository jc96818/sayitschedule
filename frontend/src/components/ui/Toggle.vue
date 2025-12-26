<script setup lang="ts">
interface Props {
  modelValue: boolean
  disabled?: boolean
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function toggle() {
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <label class="toggle-wrapper" :class="{ disabled }">
    <div class="toggle" @click="!disabled && toggle()">
      <input type="checkbox" :checked="modelValue" :disabled="disabled" @change="toggle" />
      <span class="toggle-slider"></span>
    </div>
    <span v-if="label" class="toggle-label">{{ label }}</span>
  </label>
</template>

<style scoped>
.toggle-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.toggle-wrapper.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.toggle {
  position: relative;
  width: 44px;
  height: 24px;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--border-color);
  transition: 0.3s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.toggle input:checked + .toggle-slider {
  background-color: var(--success-color);
}

.toggle input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

.toggle-wrapper.disabled .toggle-slider {
  cursor: not-allowed;
}

.toggle-label {
  font-size: 14px;
  color: var(--text-primary);
}
</style>
