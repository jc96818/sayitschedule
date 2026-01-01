<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { helpService, settingsService } from '@/services/api'
import { Alert, Button, Card } from '@/components/ui'
import HelpMarkdown from '@/components/help/HelpMarkdown.vue'
import type { HelpArticle, OrganizationFeatures, OrganizationSettings } from '@/types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

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

function backToHelp() {
  router.push('/app/help')
}

onMounted(load)

watch([categoryParam, articleParam], () => {
  load()
})
</script>

<template>
  <div class="help-article">
    <div class="topbar">
      <Button variant="ghost" @click="backToHelp">
        ← Back to Help
      </Button>
    </div>

    <Alert v-if="error" type="error" :message="error" />

    <Card v-if="article" class="content">
      <template #header>
        <div class="header">
          <div>
            <div class="category">{{ article.category.title }}</div>
            <h1 class="title">{{ article.title }}</h1>
            <p v-if="article.summary" class="summary">{{ article.summary }}</p>
          </div>
          <div class="meta">
            <span v-if="article.updatedAt" class="updated">Updated {{ new Date(article.updatedAt).toLocaleDateString() }}</span>
          </div>
        </div>
      </template>

      <div v-if="loading" class="loading">Loading…</div>
      <HelpMarkdown
        v-else
        :markdown="article.bodyMarkdown"
        :features="features"
        :settings="settings"
        :organization="authStore.organization"
      />
    </Card>
  </div>
</template>

<style scoped>
.help-article {
  padding: 24px;
  max-width: 980px;
}

.topbar {
  margin-bottom: 12px;
}

.content {
  margin-top: 12px;
}

.header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.category {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 6px;
}

.title {
  margin: 0;
  font-size: 22px;
}

.summary {
  margin: 8px 0 0;
  color: var(--text-secondary);
}

.meta {
  display: flex;
  align-items: center;
}

.updated {
  color: var(--text-muted);
  font-size: 12px;
}

.loading {
  color: var(--text-muted);
}
</style>

