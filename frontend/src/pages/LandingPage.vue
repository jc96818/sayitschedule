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

    <!-- Hero Section -->
    <main class="landing-main">
      <section id="top" class="hero section">
        <div class="hero-container">
          <div class="hero-grid">
            <div class="hero-copy">
              <p class="hero-eyebrow">Built for therapy practices</p>
              <h1>Scheduling that feels calm, not chaotic.</h1>
              <p class="hero-subtitle">
                Voice-guided scheduling with clear review steps and audit-friendly controls—so your
                team stays consistent and confident.
              </p>

              <div class="hero-cta">
                <Button variant="primary" size="lg" @click="scrollToSection('contact')">
                  Request a Demo
                </Button>
                <Button variant="outline" size="lg" @click="scrollToSection('how')">
                  See How It Works
                </Button>
              </div>

              <div class="hero-badges" aria-label="Trust and security highlights">
                <Badge variant="secondary">BAA available</Badge>
                <Badge variant="secondary">Role-based access</Badge>
                <Badge variant="secondary">MFA support</Badge>
                <Badge variant="secondary">Audit trails</Badge>
              </div>
            </div>

            <div class="hero-preview" aria-label="Product preview">
              <div class="preview-window">
                <div class="preview-topbar">
                  <div class="preview-dots" aria-hidden="true">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <div class="preview-title">Schedule assistant</div>
                </div>

                <div class="preview-body">
                  <div class="preview-panel">
                    <div class="panel-label">Voice command</div>
                    <div class="panel-content panel-command">
                      “Move Jordan’s Tuesday session to 2pm and keep Room 3.”
                    </div>
                  </div>

                  <div class="preview-panel">
                    <div class="panel-label">Result</div>
                    <div class="panel-content panel-result">
                      <div class="result-row">
                        <span class="result-chip">Tue</span>
                        <span class="result-text">
                          <strong>Jordan</strong> — 2:00–3:00 PM · Room 3
                        </span>
                      </div>
                      <div class="result-meta">Conflicts checked · Rules respected</div>
                    </div>
                  </div>

                  <div class="preview-footnote">Review changes before publishing.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="product" class="section value-section">
        <div class="section-container">
          <div class="section-heading">
            <h2>Designed for real clinic workflows</h2>
            <p>Reduce schedule churn while keeping decisions clear and reviewable.</p>
          </div>

          <div class="value-grid">
            <div class="value-card">
              <div class="value-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 6V12L16 14"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"
                    stroke="currentColor"
                    stroke-width="1.8"
                  />
                </svg>
              </div>
              <h3>Less time on admin</h3>
              <p>Make common schedule updates in seconds—without losing the thread.</p>
            </div>

            <div class="value-card">
              <div class="value-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 11L11 13L15 9"
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
              <h3>Rule-aware changes</h3>
              <p>Keep consistency across staff availability, rooms, and scheduling rules.</p>
            </div>

            <div class="value-card">
              <div class="value-icon" aria-hidden="true">
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
              <h3>Clear review before publish</h3>
              <p>See what changed, confirm it’s correct, then publish with confidence.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="how" class="section how-section">
        <div class="section-container">
          <div class="section-heading">
            <h2>How it works</h2>
            <p>A simple flow that keeps humans in control.</p>
          </div>

          <div class="steps-grid">
            <div class="step-card">
              <div class="step-number">1</div>
              <h3>Speak a change</h3>
              <p>Use natural language to describe what you want updated.</p>
              <div class="step-example">“Swap Maria and Devon on Thursday morning.”</div>
            </div>
            <div class="step-card">
              <div class="step-number">2</div>
              <h3>Review suggestions</h3>
              <p>Confirm the proposed update before anything is published.</p>
              <div class="step-example">See conflicts and rule checks inline.</div>
            </div>
            <div class="step-card">
              <div class="step-number">3</div>
              <h3>Publish schedules</h3>
              <p>Generate and distribute schedules with a clear record of changes.</p>
              <div class="step-example">Print-ready views for staff.</div>
            </div>
          </div>
        </div>
      </section>

      <section id="security" class="section security-section">
        <div class="section-container">
          <div class="security-grid">
            <div class="security-copy">
              <h2>Security & compliance focus</h2>
              <p>
                Built with multi-tenant isolation and access controls to support healthcare
                environments.
              </p>
            </div>

            <div class="security-list" role="list" aria-label="Security highlights">
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
                  <div class="security-title">Audit-friendly controls</div>
                  <div class="security-text">Track changes and keep a consistent workflow.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    <!-- Contact Form Section -->
    <section id="contact" class="contact-section">
      <div class="contact-container">
        <h2>Get in Touch</h2>
        <p class="contact-subtitle">
          Interested in simplifying your scheduling? Let us show you how Say It Schedule can
          transform your practice.
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
  min-height: 100vh;
  background: var(--background-color);
  color: var(--text-primary);
}

.landing-main {
  padding-top: var(--landing-nav-height);
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
  background: rgba(248, 250, 252, 0.8);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
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
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.15), rgba(37, 99, 235, 0.06));
  color: var(--primary-color);
  border: 1px solid rgba(37, 99, 235, 0.18);
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
  position: relative;
  padding: 68px 24px 64px;
  overflow: hidden;
}

.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(700px 380px at 18% 25%, rgba(37, 99, 235, 0.16), transparent 60%),
    radial-gradient(520px 320px at 80% 18%, rgba(16, 185, 129, 0.08), transparent 55%);
  pointer-events: none;
}

.hero-container {
  max-width: 1200px;
  margin: 0 auto;
}

.hero-grid {
  position: relative;
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  align-items: center;
  gap: 42px;
}

.hero-copy {
  text-align: left;
}

.hero-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  margin-bottom: 14px;
}

.hero h1 {
  font-size: 44px;
  font-weight: 750;
  letter-spacing: -0.02em;
  margin-bottom: 18px;
  line-height: 1.15;
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

.hero-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.hero-preview {
  display: flex;
  justify-content: flex-end;
}

.preview-window {
  width: 100%;
  max-width: 420px;
  border-radius: 18px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  background: rgba(255, 255, 255, 0.75);
  box-shadow:
    0 18px 45px rgba(15, 23, 42, 0.08),
    0 1px 0 rgba(255, 255, 255, 0.9) inset;
  overflow: hidden;
}

.preview-topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  background: rgba(248, 250, 252, 0.7);
}

.preview-dots {
  display: inline-flex;
  gap: 6px;
}

.preview-dots span {
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  background: rgba(148, 163, 184, 0.7);
}

.preview-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.preview-body {
  padding: 16px;
  display: grid;
  gap: 12px;
}

.preview-panel {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 14px;
  padding: 14px 14px 12px;
}

.panel-label {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.panel-content {
  color: var(--text-primary);
  line-height: 1.55;
  font-size: 14px;
}

.panel-command {
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial,
    sans-serif;
}

.result-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.result-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
  background: var(--primary-light);
  color: var(--primary-color);
}

.result-text {
  font-size: 14px;
  color: var(--text-primary);
}

.result-meta {
  margin-top: 10px;
  font-size: 13px;
  color: var(--text-secondary);
}

.preview-footnote {
  font-size: 13px;
  color: var(--text-secondary);
  padding: 2px 2px 0;
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
  letter-spacing: -0.01em;
  margin-bottom: 10px;
}

.section-heading p {
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1.6;
}

.value-section {
  padding: 64px 24px;
}

.value-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.value-card {
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 16px;
  padding: 22px 22px 20px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.value-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(37, 99, 235, 0.08);
  color: var(--primary-color);
  border: 1px solid rgba(37, 99, 235, 0.12);
  margin-bottom: 14px;
}

.value-icon svg {
  width: 22px;
  height: 22px;
}

.value-card h3 {
  font-size: 16px;
  margin-bottom: 8px;
}

.value-card p {
  color: var(--text-secondary);
  line-height: 1.6;
  font-size: 14px;
}

.how-section {
  padding: 64px 24px;
}

.steps-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}

.step-card {
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 16px;
  padding: 22px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.step-number {
  width: 34px;
  height: 34px;
  border-radius: 9999px;
  background: rgba(37, 99, 235, 0.1);
  color: var(--primary-color);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  margin-bottom: 14px;
}

.step-card h3 {
  font-size: 16px;
  margin-bottom: 8px;
}

.step-card p {
  color: var(--text-secondary);
  line-height: 1.6;
  font-size: 14px;
  margin-bottom: 12px;
}

.step-example {
  font-size: 13px;
  color: var(--text-primary);
  background: rgba(248, 250, 252, 0.9);
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 12px;
  padding: 10px 12px;
}

.security-section {
  padding: 64px 24px;
}

.security-grid {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: 24px;
  align-items: start;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 18px;
  padding: 26px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
}

.security-copy h2 {
  font-size: 26px;
  letter-spacing: -0.01em;
  margin-bottom: 10px;
}

.security-copy p {
  color: var(--text-secondary);
  line-height: 1.7;
  font-size: 15px;
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
  background: rgba(248, 250, 252, 0.9);
  border: 1px solid rgba(226, 232, 240, 0.9);
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
  background: rgba(37, 99, 235, 0.08);
  color: var(--primary-color);
  border: 1px solid rgba(37, 99, 235, 0.12);
}

.security-icon svg {
  width: 22px;
  height: 22px;
}

.security-title {
  font-weight: 650;
  font-size: 14px;
  margin-bottom: 2px;
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
}

.contact-container {
  max-width: 600px;
  margin: 0 auto;
  text-align: center;
}

.contact-container h2 {
  font-size: 30px;
  margin-bottom: 16px;
  color: var(--text-primary);
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
  background: rgba(255, 255, 255, 0.85);
  padding: 32px;
  border-radius: 18px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.06);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.success-message {
  text-align: center;
  margin-top: 24px;
}

/* Footer */
.landing-footer {
  padding: 28px 24px;
  text-align: center;
  border-top: 1px solid rgba(226, 232, 240, 0.9);
  background: rgba(248, 250, 252, 0.8);
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

  .hero-preview {
    justify-content: center;
  }

  .value-grid,
  .steps-grid,
  .security-grid {
    grid-template-columns: 1fr;
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
