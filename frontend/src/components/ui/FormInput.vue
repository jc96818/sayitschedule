<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue: string | number
  label?: string
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'date'
  placeholder?: string
  required?: boolean
  disabled?: boolean
  error?: string
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  required: false,
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const inputId = computed(() => props.id || `input-${Math.random().toString(36).substr(2, 9)}`)

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', props.type === 'number' ? Number(target.value) : target.value)
}
</script>

<template>
  <div class="form-group">
    <label v-if="label" :for="inputId">
      {{ label }}
      <span v-if="required" class="required">*</span>
    </label>
    <input
      :id="inputId"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :required="required"
      :disabled="disabled"
      :class="['form-control', { 'has-error': error }]"
      @input="handleInput"
    />
    <span v-if="error" class="error-message">{{ error }}</span>
  </div>
</template>

<style scoped>
.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.required {
  color: var(--danger-color);
}

.form-control {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
  background-color: white;
}

.form-control:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.form-control:disabled {
  background-color: var(--background-color);
  cursor: not-allowed;
}

.form-control::placeholder {
  color: var(--text-muted);
}

.form-control.has-error {
  border-color: var(--danger-color);
}

.form-control.has-error:focus {
  box-shadow: 0 0 0 3px var(--danger-light);
}

.error-message {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--danger-color);
}
</style>
