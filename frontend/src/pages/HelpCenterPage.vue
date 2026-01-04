<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { helpService } from '@/services/api'
import { Alert, Card, EmptyState, SearchBox } from '@/components/ui'
import { useHelpLabels } from '@/composables/useHelpLabels'
import type { HelpCategory, HelpSearchResult } from '@/types'

const { applyLabelTokens } = useHelpLabels()

const categories = ref<HelpCategory[]>([])
const categoriesLoading = ref(false)
const categoriesError = ref<string | null>(null)

const query = ref('')
const searchLoading = ref(false)
const searchResults = ref<HelpSearchResult[]>([])
const searchError = ref<string | null>(null)

const isSearching = computed(() => query.value.trim().length > 0)

function toAppHelpPath(helpSlug: string): string {
  if (helpSlug.startsWith('/help/')) {
    return '/app/help/' + helpSlug.slice('/help/'.length)
  }
  return '/app/help'
}

async function loadCategories() {
  categoriesLoading.value = true
  categoriesError.value = null
  try {
    const res = await helpService.listCategories()
    categories.value = res.data
  } catch (e) {
    categoriesError.value = e instanceof Error ? e.message : 'Failed to load help categories'
  } finally {
    categoriesLoading.value = false
  }
}

async function runSearch(value: string) {
  const q = value.trim()
  searchError.value = null

  if (!q) {
    searchResults.value = []
    return
  }

  searchLoading.value = true
  try {
    const res = await helpService.search(q, { limit: 25 })
    searchResults.value = res.data
  } catch (e) {
    searchError.value = e instanceof Error ? e.message : 'Search failed'
  } finally {
    searchLoading.value = false
  }
}

onMounted(async () => {
  await loadCategories()
})
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Help</h2>
        <p>Browse articles or search for an answer.</p>
      </div>
      <div class="header-actions">
        <SearchBox v-model="query" placeholder="Search help…" @search="runSearch" />
      </div>
    </header>

    <div class="page-content help-content">
      <Alert v-if="categoriesError" type="error" :message="categoriesError" />
      <Alert v-if="searchError" type="error" :message="searchError" />

    <Card v-if="isSearching" class="section">
      <template #header>
        <div class="section-header">
          <h2>Search results</h2>
          <span v-if="searchLoading" class="muted">Searching…</span>
        </div>
      </template>

      <EmptyState
        v-if="!searchLoading && searchResults.length === 0"
        title="No results"
        description="Try different keywords, or browse by category."
      />

      <div v-else class="results">
        <RouterLink
          v-for="r in searchResults"
          :key="r.slug"
          class="result"
          :to="toAppHelpPath(r.slug)"
        >
          <div class="result-title">{{ applyLabelTokens(r.title) }}</div>
          <div class="result-meta">{{ r.categoryTitle }}</div>
          <div v-if="r.summary" class="result-summary">{{ applyLabelTokens(r.summary) }}</div>
        </RouterLink>
      </div>
    </Card>

    <div v-else class="categories">
      <EmptyState
        v-if="!categoriesLoading && categories.length === 0"
        title="No help content yet"
        description="Import help articles to start populating the Help Center."
      />

      <Card v-for="c in categories" :key="c.slug" class="section">
        <template #header>
          <div class="section-header">
            <h2>{{ c.title }}</h2>
          </div>
        </template>

        <div class="articles">
          <RouterLink
            v-for="a in c.articles"
            :key="a.slug"
            class="article"
            :to="toAppHelpPath(a.slug)"
          >
            <div class="article-title">{{ applyLabelTokens(a.title) }}</div>
            <div v-if="a.summary" class="article-summary">{{ applyLabelTokens(a.summary) }}</div>
          </RouterLink>
        </div>
      </Card>
    </div>
    </div>
  </div>
</template>

<style scoped>
.help-content {
  max-width: 980px;
}

.section {
  margin-top: 16px;
}

.section:first-child,
.categories > .section:first-child {
  margin-top: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.muted {
  color: var(--text-muted);
  font-size: 13px;
}

.articles,
.results {
  display: grid;
  gap: 10px;
}

.article,
.result {
  display: block;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  text-decoration: none;
}

.article:hover,
.result:hover {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--primary-light);
}

.article-title,
.result-title {
  font-weight: 600;
  color: var(--text-primary);
}

.article-summary,
.result-summary {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.4;
}

.result-meta {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-muted);
}
</style>

