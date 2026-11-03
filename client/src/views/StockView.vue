<script setup>
import { onMounted, ref, watch } from 'vue';

import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';
import { formatDate, formatMoney, formatQty } from '../lib/format';
import ModalDialog from '../components/ModalDialog.vue';

const auth = useAuthStore();
const toast = useToastStore();

const items = ref([]);
const loading = ref(false);
const search = ref('');
const lowOnly = ref(false);

async function load() {
  loading.value = true;

  try {
    const data = await api.get('/stock', {
      branch: auth.branchId,
      search: search.value,
      lowOnly: lowOnly.value ? '1' : '',
    });

    items.value = data.items;
  } catch (error) {
    toast.error(error.message);
  } finally {
    loading.value = false;
  }
}

let searchTimer = null;

watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(load, 300);
});

watch(() => auth.branchId, load);
onMounted(load);

// ---------- Batches of one product ----------
const showBatches = ref(false);
const current = ref(null);
const batches = ref([]);

// the row that is being corrected
const adjusting = ref(null);
const newQuantity = ref(0);
const reason = ref('');
const saving = ref(false);

async function openBatches(row) {
  current.value = row;
  adjusting.value = null;
  showBatches.value = true;
  await loadBatches();
}

async function loadBatches() {
  try {
    const data = await api.get('/stock/batches', {
      product: current.value.productId,
      branch: current.value.branchId,
    });

    batches.value = data.items;
  } catch (error) {
    toast.error(error.message);
  }
}

function startAdjust(batch) {
  adjusting.value = batch._id;
  newQuantity.value = batch.quantity;
  reason.value = '';
}

async function saveAdjust() {
  saving.value = true;

  try {
    await api.post('/stock/adjust', {
      batchId: adjusting.value,
      newQuantity: Number(newQuantity.value),
      reason: reason.value,
    });

    toast.success('Qoldiq tuzatildi');
    adjusting.value = null;

    await loadBatches();
    await load();
  } catch (error) {
    toast.error(error.message);
  } finally {
    saving.value = false;
  }
}

function isExpired(value) {
  return value && new Date(value) < new Date();
}
</script>

<template>
  <div>
    <div class="page-head">
      <h1>Qoldiq</h1>
    </div>

    <div class="toolbar">
      <div class="field" style="min-width: 260px">
        <label>Qidirish</label>
        <input v-model="search" type="search" placeholder="Nomi yoki kodi" />
      </div>

      <label class="check" style="padding-bottom: 8px">
        <input v-model="lowOnly" type="checkbox" @change="load" />
        Faqat kam qolganlar
      </label>
    </div>

    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th>Kodi</th>
            <th>Mahsulot</th>
            <th v-if="!auth.branchId">Filial</th>
            <th class="num">Qoldiq</th>
            <th class="num">Minimum</th>
            <th v-if="auth.canManage" class="num">Qiymati (tannarx)</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in items"
            :key="row.productId + row.branchId"
            class="clickable"
            :class="{ low: row.isLow }"
            @click="openBatches(row)"
          >
            <td>{{ row.sku }}</td>
            <td>{{ row.name }}</td>
            <td v-if="!auth.branchId">{{ row.branchName }}</td>
            <td class="num">{{ formatQty(row.quantity) }} {{ row.unit }}</td>
            <td class="num">{{ formatQty(row.minStock) }}</td>
            <td v-if="auth.canManage" class="num">{{ formatMoney(row.value) }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="!loading && items.length === 0" class="empty">Qoldiq topilmadi</div>
    </div>

    <p class="muted">Partiyalarni ko'rish uchun qatorni bosing.</p>

    <ModalDialog v-if="showBatches" :title="'Partiyalar: ' + current.name" wide @close="showBatches = false">
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Partiya</th>
              <th>Yaroqlilik muddati</th>
              <th class="num">Miqdor</th>
              <th class="num">Tannarx</th>
              <th v-if="auth.canManage"></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="batch in batches" :key="batch._id">
              <tr>
                <td>{{ batch.batchNumber }}</td>
                <td>
                  <span v-if="batch.expiryDate" class="badge" :class="isExpired(batch.expiryDate) ? 'badge-bad' : ''">
                    {{ formatDate(batch.expiryDate) }}
                  </span>
                  <span v-else class="muted">-</span>
                </td>
                <td class="num">{{ formatQty(batch.quantity) }} {{ current.unit }}</td>
                <td class="num">{{ formatMoney(batch.costPrice) }}</td>
                <td v-if="auth.canManage" class="right">
                  <button class="btn btn-small" type="button" @click="startAdjust(batch)">Tuzatish</button>
                </td>
              </tr>

              <tr v-if="adjusting === batch._id">
                <td colspan="5">
                  <div class="form-grid">
                    <div class="field">
                      <label>Haqiqiy miqdor ({{ current.unit }})</label>
                      <input v-model="newQuantity" type="number" min="0" step="0.001" />
                    </div>
                    <div class="field">
                      <label>Sabab (majburiy)</label>
                      <input v-model="reason" type="text" placeholder="Masalan: sanoq natijasi" />
                    </div>
                    <div style="align-self: end; display: flex; gap: 8px">
                      <button class="btn btn-primary" type="button" :disabled="saving || !reason.trim()" @click="saveAdjust">
                        Saqlash
                      </button>
                      <button class="btn" type="button" @click="adjusting = null">Bekor qilish</button>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>

        <div v-if="batches.length === 0" class="empty">Partiya yo'q</div>
      </div>
    </ModalDialog>
  </div>
</template>
