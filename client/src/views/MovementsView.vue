<script setup>
import { onMounted, ref, watch } from 'vue';

import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';
import { daysAgoString, formatDateTime, formatQty, todayString } from '../lib/format';
import { MOVEMENT_LABELS } from '../lib/labels';
import PagerBar from '../components/PagerBar.vue';

const auth = useAuthStore();
const toast = useToastStore();

const items = ref([]);
const total = ref(0);
const page = ref(1);
const limit = 30;
const type = ref('');
const from = ref(daysAgoString(7));
const to = ref(todayString());

async function load() {
  try {
    const data = await api.get('/stock/movements', {
      page: page.value,
      limit,
      type: type.value,
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
      <h1>Qoldiq harakatlari</h1>
    </div>

    <div class="toolbar">
      <div class="field">
        <label>Turi</label>
        <select v-model="type" @change="search">
          <option value="">Hammasi</option>
          <option v-for="(label, key) in MOVEMENT_LABELS" :key="key" :value="key">{{ label }}</option>
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
            <th>Turi</th>
            <th>Mahsulot</th>
            <th>Filial</th>
            <th>Partiya</th>
            <th class="num">Miqdor</th>
            <th>Hujjat</th>
            <th>Xodim</th>
            <th>Izoh</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item._id">
            <td>{{ formatDateTime(item.createdAt) }}</td>
            <td>{{ MOVEMENT_LABELS[item.type] }}</td>
            <td>{{ item.product ? item.product.name : '-' }}</td>
            <td>{{ item.branch ? item.branch.name : '-' }}</td>
            <td>{{ item.batchNumber }}</td>
            <td class="num">
              <strong :style="{ color: item.quantity < 0 ? 'var(--danger)' : 'var(--success)' }">
                {{ item.quantity > 0 ? '+' : '' }}{{ formatQty(item.quantity) }}
              </strong>
            </td>
            <td>{{ item.refNumber }}</td>
            <td>{{ item.user ? item.user.fullName : '-' }}</td>
            <td>{{ item.note }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="items.length === 0" class="empty">Ma'lumot yo'q</div>
    </div>

    <PagerBar :page="page" :limit="limit" :total="total" @change="changePage" />
  </div>
</template>
