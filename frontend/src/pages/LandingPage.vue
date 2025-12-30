<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button, FormInput, FormSelect, FormTextarea, Alert } from '@/components/ui'
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

function scrollToContact() {
  document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <div class="landing-page">
    <!-- Navigation -->
    <nav class="landing-nav">
      <div class="nav-container">
        <div class="logo">
          <span class="logo-icon">📅</span>
          Say It Schedule
        </div>
        <Button variant="outline" @click="goToLogin">Sign In</Button>
      </div>
    </nav>

    <!-- Hero Section -->
    <section class="hero">
      <div class="hero-content">
        <h1>Voice-Powered Scheduling for Therapy Practices</h1>
        <p class="hero-subtitle">
          Schedule therapy sessions by simply speaking. Save hours every week with intelligent
          voice commands and smart scheduling.
        </p>
        <div class="hero-cta">
          <Button variant="primary" size="lg" @click="scrollToContact">Get Started</Button>
          <Button variant="outline" size="lg" @click="goToLogin">Sign In</Button>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section class="features">
      <div class="features-container">
        <h2>Why Say It Schedule?</h2>
        <p class="features-subtitle">
          Built specifically for therapy practices, our platform makes scheduling effortless.
        </p>

        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">🎤</div>
            <h3>Voice Commands</h3>
            <p>
              Create schedules, add patients, and manage staff using natural voice commands. Just
              speak and let AI do the work.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">🧠</div>
            <h3>Smart Scheduling</h3>
            <p>
              Automatically optimize schedules based on therapist availability, patient needs, and
              complex scheduling rules.
            </p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">🔒</div>
            <h3>HIPAA Compliant</h3>
            <p>
              Enterprise-grade security with full HIPAA compliance. Your patient data is protected
              with industry-leading standards.
            </p>
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
  min-height: 100vh;
  background: white;
}

/* Navigation */
.landing-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border-color);
  z-index: 100;
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: 20px;
  font-weight: 700;
  color: var(--primary-color);
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  font-size: 24px;
}

/* Hero */
.hero {
  background: linear-gradient(135deg, var(--primary-color) 0%, #1e40af 100%);
  color: white;
  padding: 160px 24px 100px;
  text-align: center;
}

.hero-content {
  max-width: 800px;
  margin: 0 auto;
}

.hero h1 {
  font-size: 48px;
  font-weight: 700;
  margin-bottom: 24px;
  line-height: 1.2;
}

.hero-subtitle {
  font-size: 20px;
  opacity: 0.9;
  margin-bottom: 40px;
  line-height: 1.6;
}

.hero-cta {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.hero-cta :deep(.btn-outline) {
  color: white;
  border-color: rgba(255, 255, 255, 0.5);
}

.hero-cta :deep(.btn-outline:hover) {
  background: rgba(255, 255, 255, 0.1);
  border-color: white;
}

/* Features */
.features {
  padding: 100px 24px;
  background: var(--background-color);
}

.features-container {
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
}

.features h2 {
  font-size: 36px;
  margin-bottom: 16px;
  color: var(--text-primary);
}

.features-subtitle {
  font-size: 18px;
  color: var(--text-secondary);
  margin-bottom: 60px;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 32px;
}

.feature-card {
  background: white;
  padding: 40px 32px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  text-align: center;
  transition: transform 0.2s, box-shadow 0.2s;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.feature-icon {
  font-size: 48px;
  margin-bottom: 20px;
}

.feature-card h3 {
  font-size: 20px;
  margin-bottom: 12px;
  color: var(--text-primary);
}

.feature-card p {
  color: var(--text-secondary);
  line-height: 1.6;
}

/* Contact Section */
.contact-section {
  padding: 100px 24px;
  background: white;
}

.contact-container {
  max-width: 600px;
  margin: 0 auto;
  text-align: center;
}

.contact-container h2 {
  font-size: 36px;
  margin-bottom: 16px;
  color: var(--text-primary);
}

.contact-subtitle {
  font-size: 18px;
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
  background: var(--background-color);
  padding: 32px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
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
  background: var(--text-primary);
  color: white;
  padding: 32px 24px;
  text-align: center;
}

.footer-container {
  max-width: 1200px;
  margin: 0 auto;
}

.landing-footer p {
  opacity: 0.8;
  font-size: 14px;
}

/* Responsive */
@media (max-width: 768px) {
  .hero {
    padding: 120px 24px 80px;
  }

  .hero h1 {
    font-size: 32px;
  }

  .hero-subtitle {
    font-size: 16px;
  }

  .features,
  .contact-section {
    padding: 60px 24px;
  }

  .features h2,
  .contact-container h2 {
    font-size: 28px;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .lead-form {
    padding: 24px;
  }
}
</style>
