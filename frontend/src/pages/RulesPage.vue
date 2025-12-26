<script setup lang="ts">
import { ref } from 'vue'
import VoiceInput from '@/components/VoiceInput.vue'

const rules = ref([
  { id: '1', category: 'gender_pairing', description: 'Male therapists can only be scheduled with male patients', isActive: true },
  { id: '2', category: 'gender_pairing', description: 'Female therapists can be scheduled with any patient', isActive: true },
  { id: '3', category: 'session', description: 'Two 1-hour sessions per therapist per day', isActive: true },
  { id: '4', category: 'availability', description: 'Exclude federal holidays from scheduling', isActive: true },
  { id: '5', category: 'specific_pairing', description: 'Always pair Ethan with patient Emilio', isActive: true }
])

function handleVoiceResult(transcript: string) {
  console.log('Voice transcript:', transcript)
  // TODO: Send to API for parsing
}
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Scheduling Rules</h2>
        <p>Manage rules that govern schedule generation</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary">Add Rule Manually</button>
      </div>
    </header>

    <div class="page-content">
      <VoiceInput
        title="Add Rule by Voice"
        description="Click the microphone and speak your scheduling rule"
        @result="handleVoiceResult"
      />

      <div class="card">
        <div class="card-header">
          <h3>Active Rules</h3>
        </div>
        <div class="card-body">
          <div v-for="rule in rules" :key="rule.id" class="rule-item">
            <div class="rule-content">
              <span class="badge badge-primary" style="margin-bottom: 4px;">{{ rule.category.replace('_', ' ') }}</span>
              <p>{{ rule.description }}</p>
            </div>
            <div class="rule-actions">
              <label class="toggle">
                <input v-model="rule.isActive" type="checkbox" />
                <span class="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rule-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  margin-bottom: 12px;
}

.rule-content p {
  margin: 0;
  font-size: 14px;
}

.toggle {
  position: relative;
  width: 44px;
  height: 24px;
  display: inline-block;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
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
}

.toggle input:checked + .toggle-slider {
  background-color: var(--success-color);
}

.toggle input:checked + .toggle-slider:before {
  transform: translateX(20px);
}
</style>
