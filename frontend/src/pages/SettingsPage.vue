<script setup lang="ts">
import { ref } from 'vue'

const organizationName = ref('Demo Organization')
const primaryColor = ref('#2563eb')
</script>

<template>
  <div>
    <header class="header">
      <div class="header-title">
        <h2>Settings</h2>
        <p>Configure organization settings</p>
      </div>
    </header>

    <div class="page-content">
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h3>Organization Branding</h3>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label>Organization Name</label>
              <input v-model="organizationName" type="text" class="form-control" />
            </div>
            <div class="form-group">
              <label>Primary Color</label>
              <input v-model="primaryColor" type="color" class="form-control" style="height: 48px;" />
            </div>
            <button class="btn btn-primary">Save Changes</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Holidays</h3>
          </div>
          <div class="card-body">
            <p class="text-muted">Federal holidays are automatically excluded from scheduling.</p>
            <ul style="margin-top: 16px; padding-left: 20px;">
              <li>New Year's Day - January 1</li>
              <li>MLK Day - January 20</li>
              <li>Presidents' Day - February 17</li>
              <li>Memorial Day - May 26</li>
              <li>Juneteenth - June 19</li>
              <li>Independence Day - July 4</li>
              <li>Labor Day - September 1</li>
              <li>Thanksgiving - November 27</li>
              <li>Christmas Day - December 25</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
