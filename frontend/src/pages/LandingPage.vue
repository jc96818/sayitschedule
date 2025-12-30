<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Alert, Badge, Button, FormInput, FormSelect, FormTextarea } from '@/components/ui'
import { leadService } from '@/services/api'

const router = useRouter()

// Lead form state
const form = ref({
  name: '',
  email: '',
  company: '',
  phone: '',
  role: '',
  message: ''
})

const roleOptions = [
  { value: 'administrator', label: 'Administrator' },
  { value: 'therapist', label: 'Therapist' },
  { value: 'manager', label: 'Practice Manager' },
  { value: 'owner', label: 'Practice Owner' },
  { value: 'other', label: 'Other' }
]

type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'secondary'

type DemoCheck = {
  label: string
  variant: BadgeVariant
}

type DemoResult = {
  title: string
  summary: string
  removed: string[]
  added: string[]
  checks: DemoCheck[]
}

type DemoExample = {
  label: string
  command: string
  result: DemoResult
}

const demoExamples: DemoExample[] = [
  {
    label: 'Move session',
    command: 'Move Jordan’s Tuesday session to 2pm and keep Room 3.',
    result: {
      title: '1 change · ready to review',
      summary: 'No conflicts detected. Rules respected.',
      removed: ['Tue 1:00–2:00 PM · Jordan · Room 3'],
      added: ['Tue 2:00–3:00 PM · Jordan · Room 3'],
      checks: [
        { label: 'Availability OK', variant: 'success' },
        { label: 'Room OK', variant: 'success' },
        { label: 'Rules OK', variant: 'success' }
      ]
    }
  },
  {
    label: 'Swap appointments',
    command: 'Swap Maria and Devon on Thursday morning.',
    result: {
      title: '2 changes · ready to review',
      summary: 'No conflicts detected. Update is reversible until publish.',
      removed: [
        'Thu 9:00–10:00 AM · Maria · Room 2',
        'Thu 10:00–11:00 AM · Devon · Room 2'
      ],
      added: [
        'Thu 9:00–10:00 AM · Devon · Room 2',
        'Thu 10:00–11:00 AM · Maria · Room 2'
      ],
      checks: [
        { label: 'Availability OK', variant: 'success' },
        { label: 'Room OK', variant: 'success' },
        { label: 'Rules OK', variant: 'success' }
      ]
    }
  },
  {
    label: 'Block time',
    command: 'Block Friday 3–5pm for a staff meeting.',
    result: {
      title: 'Draft hold · ready to validate',
      summary: 'Creates a hold and flags affected sessions for review.',
      removed: ['Fri 3:30–4:30 PM · Open slot · Room 1'],
      added: ['Fri 3:00–5:00 PM · Staff meeting · Room 1 (hold)'],
      checks: [
        { label: 'Parsed', variant: 'success' },
        { label: 'Conflict check', variant: 'warning' },
        { label: 'Rules validation', variant: 'secondary' }
      ]
    }
  }
]

const demoSelected = ref(0)
const demoCommand = ref(demoExamples[0].command)
const demoRunning = ref(false)
const demoResult = ref<DemoResult>(demoExamples[0].result)

const loading = ref(false)
const success = ref(false)
const error = ref('')

async function submitLead() {
  if (!form.value.name || !form.value.email) {
    error.value = 'Please fill in all required fields.'
    return
  }

  loading.value = true
  error.value = ''

  try {
    await leadService.submit({
      name: form.value.name,
      email: form.value.email,
      company: form.value.company || undefined,
      phone: form.value.phone || undefined,
      role: form.value.role || undefined,
      message: form.value.message || undefined
    })
    success.value = true
    form.value = { name: '', email: '', company: '', phone: '', role: '', message: '' }
  } catch (e: unknown) {
    const axiosError = e as { response?: { data?: { error?: string } } }
    error.value = axiosError.response?.data?.error || 'Something went wrong. Please try again.'
  } finally {
    loading.value = false
  }
}

function goToLogin() {
  router.push('/login')
}

function scrollToSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function selectDemoExample(index: number) {
  demoSelected.value = index
  demoCommand.value = demoExamples[index].command
  demoResult.value = demoExamples[index].result
}

function runDemo() {
  demoRunning.value = true
  const trimmedCommand = demoCommand.value.trim()
  const match = demoExamples.find((example) => example.command === trimmedCommand)

  window.setTimeout(() => {
    demoRunning.value = false
    demoResult.value =
      match?.result ?? {
        title: 'Draft change',
        summary: 'Proposed update ready for review.',
        removed: ['No changes applied yet.'],
        added: ['Run validation to see a schedule diff.'],
        checks: [
          { label: 'Parsed', variant: 'success' },
          { label: 'Conflict check', variant: 'secondary' },
          { label: 'Rules validation', variant: 'secondary' }
        ]
      }
  }, 450)
}
</script>

<template>
  <div class="landing-page">
    <!-- Navigation -->
    <nav class="landing-nav">
      <div class="nav-container">
        <a href="#top" class="logo" @click.prevent="scrollToSection('top')">
          <span class="logo-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path
                d="M8 6V4M16 6V4M7 9H17M7 12H11M7 15H10M14 13.5L15.5 15L18 12.5"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M7 5.5H17C18.1046 5.5 19 6.39543 19 7.5V18C19 19.1046 18.1046 20 17 20H7C5.89543 20 5 19.1046 5 18V7.5C5 6.39543 5.89543 5.5 7 5.5Z"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          <span class="logo-text">Say It Schedule</span>
        </a>

        <div class="nav-links" aria-label="Landing page sections">
          <a href="#product" @click.prevent="scrollToSection('product')">Product</a>
          <a href="#how" @click.prevent="scrollToSection('how')">How it works</a>
          <a href="#security" @click.prevent="scrollToSection('security')">Security</a>
          <a href="#contact" @click.prevent="scrollToSection('contact')">Contact</a>
        </div>

        <div class="nav-actions">
          <Button variant="outline" size="sm" @click="goToLogin">Sign In</Button>
          <Button variant="primary" size="sm" @click="scrollToSection('contact')">Request Demo</Button>
        </div>
      </div>
    </nav>

    <!-- Main -->
    <main class="landing-main">
      <section id="top" class="hero section">
        <div class="hero-container">
          <div class="hero-grid">
            <div class="hero-copy">
              <div class="hero-kicker">
                <Badge variant="primary">Voice + Rules Engine</Badge>
                <span class="hero-kicker-text">for therapy practices</span>
              </div>
              <h1>Voice-assisted scheduling, with a clear review step.</h1>
              <p class="hero-subtitle">
                Make schedule updates in plain language, review a proposed diff, and publish with
                confidence—without losing control of the workflow.
              </p>

              <div class="hero-cta">
                <Button variant="primary" size="lg" @click="scrollToSection('contact')">
                  Request Demo
                </Button>
                <Button variant="outline" size="lg" @click="goToLogin">Sign In</Button>
              </div>

              <div class="hero-foot" aria-label="Platform highlights">
                <div class="hero-foot-item">
                  <span class="hero-foot-dot" aria-hidden="true"></span>
                  Multi-tenant by subdomain
                </div>
                <div class="hero-foot-item">
                  <span class="hero-foot-dot" aria-hidden="true"></span>
                  Review-first changes
                </div>
                <div class="hero-foot-item">
                  <span class="hero-foot-dot" aria-hidden="true"></span>
                  Audit-friendly workflow
                </div>
              </div>
            </div>

            <div class="hero-demo" aria-label="Interactive command demo">
              <div class="demo-card">
                <div class="demo-header">
                  <div class="demo-title">Live command demo</div>
                  <div class="demo-status" :class="{ running: demoRunning }">
                    <span class="status-dot" aria-hidden="true"></span>
                    {{ demoRunning ? 'Running' : 'Ready' }}
                  </div>
                </div>

                <div class="demo-examples" aria-label="Example commands">
                  <button
                    v-for="(example, index) in demoExamples"
                    :key="example.label"
                    type="button"
                    class="example-chip"
                    :class="{ active: index === demoSelected }"
                    :aria-pressed="index === demoSelected"
                    @click="selectDemoExample(index)"
                  >
                    {{ example.label }}
                  </button>
                </div>

                <div class="command-bar">
                  <span class="command-prompt" aria-hidden="true">&gt;</span>
                  <input
                    v-model="demoCommand"
                    class="command-input"
                    type="text"
                    spellcheck="false"
                    aria-label="Demo command"
                  />
                  <Button variant="primary" size="sm" :disabled="demoRunning" @click="runDemo">
                    {{ demoRunning ? 'Running…' : 'Run' }}
                  </Button>
                </div>

                <div class="demo-output" aria-label="Demo output">
                  <div class="output-title">{{ demoResult.title }}</div>
                  <div class="output-summary">{{ demoResult.summary }}</div>

                  <div class="diff" aria-label="Schedule diff">
                    <div
                      v-for="(line, idx) in demoResult.removed"
                      :key="`r-${idx}`"
                      class="diff-line diff-remove"
                    >
                      <span class="diff-prefix">-</span>
                      <span class="diff-text">{{ line }}</span>
                    </div>
                    <div
                      v-for="(line, idx) in demoResult.added"
                      :key="`a-${idx}`"
                      class="diff-line diff-add"
                    >
                      <span class="diff-prefix">+</span>
                      <span class="diff-text">{{ line }}</span>
                    </div>
                  </div>

                  <div class="checks" aria-label="Validation checks">
                    <Badge
                      v-for="(check, idx) in demoResult.checks"
                      :key="idx"
                      :variant="check.variant"
                      class="check-badge"
                    >
                      {{ check.label }}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="product" class="section platform-section">
        <div class="section-container">
          <div class="section-heading">
            <h2>Platform highlights</h2>
            <p>Fast to use, built to be reviewed, and designed for clinic scheduling complexity.</p>
          </div>

          <div class="feature-grid">
            <div class="feature-card">
              <div class="feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3C14.5 3 16.5 5 16.5 7.5V11C16.5 13.5 14.5 15.5 12 15.5C9.5 15.5 7.5 13.5 7.5 11V7.5C7.5 5 9.5 3 12 3Z"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M6 10.5V11C6 14.3137 8.68629 17 12 17C15.3137 17 18 14.3137 18 11V10.5"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M12 17V21"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
              <h3>Command-first edits</h3>
              <p>Speak or type schedule changes in plain language.</p>
            </div>

            <div class="feature-card">
              <div class="feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 12L11 14L15 10"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M7 4H17C18.1046 4 19 4.89543 19 6V20L12 17L5 20V6C5 4.89543 5.89543 4 7 4Z"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
              <h3>Rules & conflict checks</h3>
              <p>Validate availability, rooms, and constraints before you publish.</p>
            </div>

            <div class="feature-card">
              <div class="feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M7 7H17M7 12H17M7 17H13"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M7 3H17C18.1046 3 19 3.89543 19 5V19C19 20.1046 18.1046 21 17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3Z"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
              <h3>Diff-first review</h3>
              <p>See what changed, confirm it’s correct, then publish with confidence.</p>
            </div>

            <div class="feature-card">
              <div class="feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 12V8C4 6.89543 4.89543 6 6 6H18C19.1046 6 20 6.89543 20 8V12"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M7 14H17M7 18H14"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M8 6V4M16 6V4"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
              <h3>Clinic-ready views</h3>
              <p>Clear schedule views for staff, including print-ready formats.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="how" class="section pipeline-section">
        <div class="section-container">
          <div class="section-heading">
            <h2>AI workflow, human control</h2>
            <p>Every change stays reviewable until you publish.</p>
          </div>

          <ol class="pipeline" aria-label="Workflow steps">
            <li class="pipeline-step">
              <div class="step-badge">01</div>
              <div>
                <div class="step-title">Capture</div>
                <div class="step-text">Voice or typed commands.</div>
              </div>
            </li>
            <li class="pipeline-step">
              <div class="step-badge">02</div>
              <div>
                <div class="step-title">Parse</div>
                <div class="step-text">Turn intent into structured updates.</div>
              </div>
            </li>
            <li class="pipeline-step">
              <div class="step-badge">03</div>
              <div>
                <div class="step-title">Validate</div>
                <div class="step-text">Check conflicts and rules.</div>
              </div>
            </li>
            <li class="pipeline-step">
              <div class="step-badge">04</div>
              <div>
                <div class="step-title">Preview</div>
                <div class="step-text">Review a clear schedule diff.</div>
              </div>
            </li>
            <li class="pipeline-step">
              <div class="step-badge">05</div>
              <div>
                <div class="step-title">Publish</div>
                <div class="step-text">Share schedules with staff.</div>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <section id="security" class="section security-section">
        <div class="section-container">
          <div class="security-grid">
            <div class="security-copy">
              <h2>Security built in</h2>
              <p>
                Designed for multi-tenant healthcare workflows with access controls and audit-ready
                patterns.
              </p>

              <div class="security-badges" aria-label="Security highlights">
                <Badge variant="secondary">BAA available</Badge>
                <Badge variant="secondary">Tenant isolation</Badge>
                <Badge variant="secondary">RBAC</Badge>
                <Badge variant="secondary">MFA</Badge>
                <Badge variant="secondary">Audit trails</Badge>
              </div>
            </div>

            <div class="security-list" role="list" aria-label="Security details">
              <div class="security-item" role="listitem">
                <span class="security-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 22C12 22 20 18 20 12V6L12 3L4 6V12C4 18 12 22 12 22Z"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M9 12L11 14L15 10"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
                <div>
                  <div class="security-title">BAA available</div>
                  <div class="security-text">Support for regulated workflows and agreements.</div>
                </div>
              </div>

              <div class="security-item" role="listitem">
                <span class="security-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M8 7H16M8 11H16M8 15H12"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M6 3H18C19.1046 3 20 3.89543 20 5V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V5C4 3.89543 4.89543 3 6 3Z"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
                <div>
                  <div class="security-title">Tenant isolation</div>
                  <div class="security-text">Organization-scoped data access and separation.</div>
                </div>
              </div>

              <div class="security-item" role="listitem">
                <span class="security-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 11C13.6569 11 15 9.65685 15 8C15 6.34315 13.6569 5 12 5C10.3431 5 9 6.34315 9 8C9 9.65685 10.3431 11 12 11Z"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M5 19C5.5 16 8.5 14 12 14C15.5 14 18.5 16 19 19"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
                <div>
                  <div class="security-title">Role-based access</div>
                  <div class="security-text">Limit access by user role and organization.</div>
                </div>
              </div>

              <div class="security-item" role="listitem">
                <span class="security-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M7 11V8C7 5.23858 9.23858 3 12 3C14.7614 3 17 5.23858 17 8V11"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M6 11H18C19.1046 11 20 11.8954 20 13V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V13C4 11.8954 4.89543 11 6 11Z"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M12 15V17"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
                <div>
                  <div class="security-title">MFA support</div>
                  <div class="security-text">Add a second factor for account protection.</div>
                </div>
              </div>

              <div class="security-item" role="listitem">
                <span class="security-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M8 7H16M8 12H16M8 17H13"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M7 3H17C18.1046 3 19 3.89543 19 5V19C19 20.1046 18.1046 21 17 21H7C5.89543 21 5 20.1046 5 19V5C5 3.89543 5.89543 3 7 3Z"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
                <div>
                  <div class="security-title">Audit trails</div>
                  <div class="security-text">Keep a clear record of changes and approvals.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    <!-- Contact Form Section -->
    <section id="contact" class="contact-section">
      <div class="contact-container">
        <h2>Request a Demo</h2>
        <p class="contact-subtitle">
          Tell us a bit about your practice and we’ll schedule a walkthrough.
        </p>

        <div class="lead-form-wrapper">
          <Alert v-if="success" variant="success" class="form-alert">
            Thank you for your interest! We will be in touch shortly.
          </Alert>

          <Alert v-if="error" variant="danger" class="form-alert" dismissible @dismiss="error = ''">
            {{ error }}
          </Alert>

          <form v-if="!success" class="lead-form" @submit.prevent="submitLead">
            <div class="form-row">
              <FormInput
                v-model="form.name"
                label="Name"
                placeholder="Your full name"
                required
              />
              <FormInput
                v-model="form.email"
                label="Email"
                type="email"
                placeholder="your@email.com"
                required
              />
            </div>

            <div class="form-row">
              <FormInput
                v-model="form.company"
                label="Company / Practice"
                placeholder="Your practice name"
              />
              <FormInput v-model="form.phone" label="Phone" type="tel" placeholder="(555) 123-4567" />
            </div>

            <FormSelect
              v-model="form.role"
              label="Your Role"
              :options="roleOptions"
              placeholder="Select your role"
            />

            <FormTextarea
              v-model="form.message"
              label="Message (Optional)"
              placeholder="Tell us about your scheduling needs..."
              :rows="4"
            />

            <Button type="submit" variant="primary" size="lg" block :loading="loading">
              Request Demo
            </Button>
          </form>

          <div v-else class="success-message">
            <Button variant="outline" @click="goToLogin">Sign In to Your Account</Button>
          </div>
        </div>
      </div>
    </section>
    </main>

    <!-- Footer -->
    <footer class="landing-footer">
      <div class="footer-container">
        <p>&copy; {{ new Date().getFullYear() }} Say It Schedule. All rights reserved.</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.landing-page {
  --landing-nav-height: 76px;
  --background-color: #f6f8fc;
  --card-background: rgba(255, 255, 255, 0.78);
  --border-color: rgba(15, 23, 42, 0.12);
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #64748b;

  --primary-color: #2563eb;
  --primary-hover: #1d4ed8;
  --primary-light: rgba(37, 99, 235, 0.16);

  --secondary-color: #64748b;
  --success-color: #10b981;
  --success-light: rgba(16, 185, 129, 0.14);
  --warning-color: #f59e0b;
  --warning-light: rgba(245, 158, 11, 0.14);
  --danger-color: #ef4444;
  --danger-light: rgba(239, 68, 68, 0.14);
  min-height: 100vh;
  color: var(--text-primary);
  background: var(--background-color);
  position: relative;
  overflow-x: hidden;
}

.landing-page :deep(.badge-secondary) {
  background-color: rgba(255, 255, 255, 0.7);
  color: var(--text-secondary);
  border: 1px solid rgba(15, 23, 42, 0.1);
}

.landing-page::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(900px 520px at 18% 18%, rgba(37, 99, 235, 0.16), transparent 62%),
    radial-gradient(760px 460px at 82% 16%, rgba(16, 185, 129, 0.08), transparent 62%),
    radial-gradient(820px 520px at 50% 110%, rgba(99, 102, 241, 0.08), transparent 66%);
  z-index: 0;
}

.landing-page::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: radial-gradient(rgba(15, 23, 42, 0.1) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: radial-gradient(900px 520px at 50% 0%, rgba(0, 0, 0, 0.45), transparent 70%);
  opacity: 0.12;
  z-index: 0;
}

.landing-main {
  padding-top: var(--landing-nav-height);
  position: relative;
  z-index: 1;
}

.section {
  scroll-margin-top: calc(var(--landing-nav-height) + 20px);
}

/* Navigation */
.landing-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--landing-nav-height);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  z-index: 100;
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  height: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--text-primary);
  font-weight: 700;
  letter-spacing: -0.01em;
}

.logo-mark {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.18), rgba(16, 185, 129, 0.1));
  color: var(--primary-color);
  border: 1px solid rgba(37, 99, 235, 0.14);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.logo-mark svg {
  width: 20px;
  height: 20px;
}

.logo-text {
  font-size: 16px;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 22px;
}

.nav-links a {
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition: color 0.2s;
}

.nav-links a:hover {
  color: var(--text-primary);
  text-decoration: none;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Hero */
.hero {
  padding: 82px 24px 56px;
}

.hero-container {
  max-width: 1200px;
  margin: 0 auto;
}

.hero-grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  align-items: center;
  gap: 42px;
}

.hero-copy {
  text-align: left;
}

.hero-kicker {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.hero-kicker-text {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.hero h1 {
  font-size: 46px;
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-bottom: 18px;
  line-height: 1.08;
  color: var(--text-primary);
}

@supports (-webkit-background-clip: text) {
  .hero h1 {
    background: linear-gradient(
      90deg,
      rgba(15, 23, 42, 0.95),
      rgba(37, 99, 235, 0.92),
      rgba(16, 185, 129, 0.82)
    );
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
}

.hero-subtitle {
  font-size: 18px;
  color: var(--text-secondary);
  margin-bottom: 28px;
  line-height: 1.6;
}

.hero-cta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.hero-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 18px;
  margin-top: 22px;
  color: var(--text-secondary);
  font-size: 13px;
}

.hero-foot-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.hero-foot-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: rgba(37, 99, 235, 0.8);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.14);
}

.hero-demo {
  display: flex;
  justify-content: flex-end;
}

.demo-card {
  width: 100%;
  max-width: 460px;
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(18px);
  box-shadow: 0 30px 70px rgba(15, 23, 42, 0.12);
  overflow: hidden;
}

.demo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(248, 250, 252, 0.7);
}

.demo-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.demo-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  background: rgba(16, 185, 129, 0.85);
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.16);
}

.demo-status.running .status-dot {
  background: rgba(37, 99, 235, 0.85);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.16);
}

.demo-examples {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 14px 16px 0;
}

.example-chip {
  appearance: none;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(248, 250, 252, 0.6);
  color: var(--text-secondary);
  border-radius: 9999px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s, transform 0.2s;
}

.example-chip:hover {
  border-color: rgba(15, 23, 42, 0.16);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.example-chip.active {
  background: rgba(37, 99, 235, 0.12);
  border-color: rgba(37, 99, 235, 0.28);
  color: var(--text-primary);
}

.command-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 16px 0;
  padding: 10px 10px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: rgba(255, 255, 255, 0.7);
}

.command-prompt {
  color: rgba(15, 23, 42, 0.5);
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
}

.command-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: rgba(15, 23, 42, 0.9);
  font-size: 13px;
  line-height: 1.4;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
}

.command-input::placeholder {
  color: rgba(15, 23, 42, 0.45);
}

.demo-output {
  padding: 16px;
  display: grid;
  gap: 10px;
}

.output-title {
  font-size: 13px;
  font-weight: 700;
  color: rgba(15, 23, 42, 0.9);
}

.output-summary {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.55;
}

.diff {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  background: rgba(248, 250, 252, 0.8);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
  font-size: 12.5px;
}

.diff-line {
  display: grid;
  grid-template-columns: 18px 1fr;
  gap: 10px;
  align-items: baseline;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid transparent;
}

.diff-prefix {
  font-weight: 800;
  opacity: 0.85;
}

.diff-text {
  color: rgba(15, 23, 42, 0.88);
  line-height: 1.45;
}

.diff-remove {
  background: rgba(248, 113, 113, 0.1);
  border-color: rgba(248, 113, 113, 0.2);
}

.diff-remove .diff-prefix {
  color: rgba(248, 113, 113, 0.95);
}

.diff-add {
  background: rgba(52, 211, 153, 0.1);
  border-color: rgba(52, 211, 153, 0.2);
}

.diff-add .diff-prefix {
  color: rgba(52, 211, 153, 0.95);
}

.checks {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.check-badge {
  white-space: nowrap;
}

/* Sections */
.section-container {
  max-width: 1200px;
  margin: 0 auto;
}

.section-heading {
  text-align: center;
  margin-bottom: 42px;
}

.section-heading h2 {
  font-size: 30px;
  letter-spacing: -0.02em;
  margin-bottom: 10px;
  color: rgba(226, 232, 240, 0.95);
}

.section-heading p {
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1.6;
}

.platform-section {
  padding: 64px 24px 40px;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
}

.feature-card {
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 16px;
  padding: 22px 20px 20px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
}

.feature-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(37, 99, 235, 0.1);
  color: var(--primary-color);
  border: 1px solid rgba(37, 99, 235, 0.14);
  margin-bottom: 14px;
}

.feature-icon svg {
  width: 22px;
  height: 22px;
}

.feature-card h3 {
  font-size: 16px;
  margin-bottom: 8px;
  color: rgba(15, 23, 42, 0.92);
}

.feature-card p {
  color: var(--text-secondary);
  line-height: 1.6;
  font-size: 14px;
}

.pipeline-section {
  padding: 48px 24px 64px;
}

.pipeline {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 18px;
}

.pipeline-step {
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
  display: grid;
  gap: 12px;
}

.step-badge {
  width: fit-content;
  padding: 6px 10px;
  border-radius: 9999px;
  background: rgba(248, 250, 252, 0.85);
  border: 1px solid rgba(15, 23, 42, 0.12);
  color: rgba(15, 23, 42, 0.62);
  font-size: 12px;
  font-weight: 800;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
}

.step-title {
  font-size: 14px;
  font-weight: 750;
  color: rgba(15, 23, 42, 0.92);
  margin-bottom: 2px;
}

.step-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.55;
}

.security-section {
  padding: 64px 24px;
}

.security-grid {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: 24px;
  align-items: start;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 18px;
  padding: 26px;
  box-shadow: 0 26px 60px rgba(15, 23, 42, 0.1);
}

.security-copy h2 {
  font-size: 26px;
  letter-spacing: -0.01em;
  margin-bottom: 10px;
  color: rgba(15, 23, 42, 0.95);
}

.security-copy p {
  color: var(--text-secondary);
  line-height: 1.7;
  font-size: 15px;
  margin-bottom: 16px;
}

.security-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.security-list {
  display: grid;
  gap: 14px;
}

.security-item {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 12px;
  align-items: start;
  background: rgba(248, 250, 252, 0.85);
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 14px;
  padding: 14px;
}

.security-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(37, 99, 235, 0.1);
  color: var(--primary-color);
  border: 1px solid rgba(37, 99, 235, 0.14);
}

.security-icon svg {
  width: 22px;
  height: 22px;
}

.security-title {
  font-weight: 650;
  font-size: 14px;
  margin-bottom: 2px;
  color: rgba(15, 23, 42, 0.92);
}

.security-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.55;
}

/* Contact Section */
.contact-section {
  padding: 72px 24px 84px;
  background: transparent;
  position: relative;
  z-index: 1;
}

.contact-container {
  max-width: 600px;
  margin: 0 auto;
  text-align: center;
}

.contact-container h2 {
  font-size: 30px;
  margin-bottom: 16px;
  color: rgba(15, 23, 42, 0.95);
}

.contact-subtitle {
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: 40px;
}

.lead-form-wrapper {
  text-align: left;
}

.form-alert {
  margin-bottom: 24px;
}

.lead-form {
  background: rgba(255, 255, 255, 0.72);
  padding: 32px;
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  box-shadow: 0 26px 60px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(18px);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.contact-section :deep(input.form-control),
.contact-section :deep(select.form-control),
.contact-section :deep(textarea.form-control) {
  background-color: rgba(255, 255, 255, 0.8);
  border-color: rgba(15, 23, 42, 0.12);
  color: rgba(15, 23, 42, 0.92);
}

.contact-section :deep(select.form-control) {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2364758b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
}

.success-message {
  text-align: center;
  margin-top: 24px;
}

/* Footer */
.landing-footer {
  padding: 28px 24px;
  text-align: center;
  border-top: 1px solid rgba(15, 23, 42, 0.08);
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(16px);
  position: relative;
  z-index: 1;
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
}

.landing-footer p {
  color: var(--text-secondary);
  font-size: 14px;
}

/* Responsive */
@media (max-width: 768px) {
  .landing-page {
    --landing-nav-height: 72px;
  }

  .hero h1 {
    font-size: 32px;
  }

  .hero-subtitle {
    font-size: 16px;
  }

  .nav-links {
    display: none;
  }

  .hero-grid {
    grid-template-columns: 1fr;
    gap: 28px;
  }

  .hero-copy {
    text-align: center;
  }

  .hero-cta {
    justify-content: center;
  }

  .hero-demo {
    justify-content: center;
  }

  .feature-grid,
  .security-grid {
    grid-template-columns: 1fr;
  }

  .pipeline {
    grid-template-columns: 1fr;
  }

  .platform-section {
    padding: 56px 24px 32px;
  }

  .security-grid {
    padding: 22px;
  }

  .contact-section {
    padding: 60px 24px 72px;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .lead-form {
    padding: 24px;
  }
}
</style>
