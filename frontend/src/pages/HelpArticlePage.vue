<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { helpService, settingsService } from '@/services/api'
import { Alert, Card } from '@/components/ui'
import HelpMarkdown from '@/components/help/HelpMarkdown.vue'
import { useHelpLabels } from '@/composables/useHelpLabels'
import type { HelpArticle, OrganizationFeatures, OrganizationSettings } from '@/types'

const route = useRoute()
const authStore = useAuthStore()
const { applyLabelTokens } = useHelpLabels()

const article = ref<HelpArticle | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const features = ref<OrganizationFeatures | null>(null)
const settings = ref<OrganizationSettings | null>(null)

const categoryParam = computed(() => route.params.category as string)
const articleParam = computed(() => route.params.article as string)

async function load() {
  loading.value = true
  error.value = null

  try {
    const [articleRes, featuresRes, settingsRes] = await Promise.all([
      helpService.getArticle(categoryParam.value, articleParam.value),
      settingsService.getFeatures().catch(() => null),
      settingsService.getSettings().catch(() => null)
    ])

    article.value = articleRes.data
    features.value = featuresRes?.data ?? null
    settings.value = settingsRes?.data ?? null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load article'
    article.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)

watch([categoryParam, articleParam], () => {
  load()
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <RouterLink to="/app/help" class="back-link">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Help
        </RouterLink>
        <div class="title-row">
          <h2>{{ article ? applyLabelTokens(article.title) : 'Help Article' }}</h2>
          <span v-if="article" class="category-badge">{{ article.category.title }}</span>
        </div>
        <p v-if="article?.summary" class="header-summary">{{ applyLabelTokens(article.summary) }}</p>
      </div>
      <div v-if="article?.updatedAt" class="header-actions">
        <span class="updated">Updated {{ new Date(article.updatedAt).toLocaleDateString() }}</span>
      </div>
    </header>

    <div class="page-content help-article-content">
      <Alert v-if="error" type="error" :message="error" />

      <div v-if="loading" class="loading">Loading…</div>

      <Card v-else-if="article" class="article-card">
        <HelpMarkdown
          :markdown="article.bodyMarkdown"
          :features="features"
          :settings="settings"
          :organization="authStore.organization"
        />
      </Card>
    </div>
  </div>
</template>

<style scoped>
.header {
  height: auto;
  min-height: var(--header-height);
  padding: 16px 24px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: var(--text-secondary);
  text-decoration: none;
  margin-bottom: 8px;
}

.back-link:hover {
  color: var(--primary-color);
}

.title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-row h2 {
  margin: 0;
}

.category-badge {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 2px 8px;
  background: var(--background-color);
  border-radius: var(--radius-sm);
}

.header-summary {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.updated {
  color: var(--text-muted);
  font-size: 12px;
}

.help-article-content {
  max-width: 980px;
}

.article-card {
  margin-top: 0;
}

.loading {
  color: var(--text-muted);
  padding: 24px;
}
</style>

