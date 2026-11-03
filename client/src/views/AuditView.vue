<script setup>
import { onMounted, ref, watch } from 'vue';

import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';
import { formatDateTime } from '../lib/format';
import { ACTION_LABELS, ENTITY_LABELS } from '../lib/labels';
import PagerBar from '../components/PagerBar.vue';

const auth = useAuthStore();
const toast = useToastStore();

const items = ref([]);
const total = ref(0);
const page = ref(1);
const limit = 30;
const entity = ref('');
const from = ref('');
const to = ref('');

async function load() {
  try {
    const data = await api.get('/audit', {
      page: page.value,
      limit,
      entity: entity.value,
      from: from.value,
      to: to.value,
      branch: auth.branchId,
    });

    items.value = data.items;
    total.value = data.total;
  } catch (error) {
    toast.error(error.message);
  }
}

// Turns {price: 10} into lines like "price: 10"
function describe(values) {
  if (!values) {
    return '';
  }

  return Object.keys(values)
    .map((key) => key + ': ' + JSON.stringify(values[key]))
    .join('\n');
}

function changePage(newPage) {
  page.value = newPage;
  load();
}

function search() {
  page.value = 1;
  load();
}

onMounted(load);
watch(() => auth.branchId, search);
</script>

<template>
  <div>
    <div class="page-head">
      <h1>O'zgarishlar tarixi</h1>
    </div>

    <div class="toolbar">
      <div class="field">
        <label>Bo'lim</label>
        <select v-model="entity" @change="search">
          <option value="">Hammasi</option>
          <option v-for="(label, key) in ENTITY_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
      </div>
      <div class="field">
        <label>Sanadan</label>
        <input v-model="from" type="date" @change="search" />
      </div>
      <div class="field">
        <label>Sanagacha</label>
        <input v-model="to" type="date" @change="search" />
      </div>
    </div>

    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th>Vaqt</th>
            <th>Xodim</th>
            <th>Amal</th>
            <th>Bo'lim</th>
            <th>Nomi</th>
            <th>Oldin</th>
            <th>Keyin</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item._id">
            <td>{{ formatDateTime(item.createdAt) }}</td>
            <td>{{ item.username }}</td>
            <td>{{ ACTION_LABELS[item.action] || item.action }}</td>
            <td>{{ ENTITY_LABELS[item.entity] || item.entity }}</td>
            <td>{{ item.label }}</td>
            <td style="white-space: pre-line">{{ describe(item.before) }}</td>
            <td style="white-space: pre-line">{{ describe(item.after) }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="items.length === 0" class="empty">Ma'lumot yo'q</div>
    </div>

    <PagerBar :page="page" :limit="limit" :total="total" @change="changePage" />
  </div>
</template>
