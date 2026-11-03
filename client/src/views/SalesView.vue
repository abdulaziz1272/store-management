<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';

import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { usePrintStore } from '../stores/print';
import { useToastStore } from '../stores/toast';
import { formatDateTime, formatMoney, formatNumber, formatQty, todayString } from '../lib/format';
import { PAYMENT_LABELS, SALE_STATUS_LABELS } from '../lib/labels';
import ModalDialog from '../components/ModalDialog.vue';
import PagerBar from '../components/PagerBar.vue';

const auth = useAuthStore();
const printStore = usePrintStore();
const toast = useToastStore();

// ---------- List ----------
const items = ref([]);
const total = ref(0);
const page = ref(1);
const limit = 20;
const from = ref(todayString());
const to = ref(todayString());
const searchText = ref('');

async function load() {
  try {
    const data = await api.get('/sales', {
      page: page.value,
      limit,
      from: from.value,
      to: to.value,
      search: searchText.value,
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

function statusClass(status) {
  if (status === 'completed') {
    return 'badge-ok';
  }

  return status === 'returned' ? 'badge-bad' : 'badge-warn';
}

function paymentText(sale) {
  return sale.payments.map((payment) => PAYMENT_LABELS[payment.method] + ' ' + formatNumber(payment.amount)).join(', ');
}

// ---------- One sale: receipt and return ----------
const sale = ref(null);
const returnMode = ref(false);
const returnQuantities = reactive({});
const refundMethod = ref('cash');
const reason = ref('');
const saving = ref(false);

async function openSale(id) {
  try {
    const data = await api.get('/sales/' + id);
    sale.value = data.sale;
    returnMode.value = false;
  } catch (error) {
    toast.error(error.message);
  }
}

function startReturn() {
  returnMode.value = true;
  refundMethod.value = sale.value.customer && sale.value.debtAmount > 0 ? 'debt' : 'cash';
  reason.value = '';

  sale.value.items.forEach((line, index) => {
    returnQuantities[index] = 0;
  });
}

function canReturn(line) {
  return Math.round((line.quantity - line.returnedQuantity) * 1000) / 1000;
}

// The refund keeps the same discount share as the sale
const refundPreview = computed(() => {
  if (!sale.value || !returnMode.value) {
    return 0;
  }

  const ratio = sale.value.subtotal > 0 ? sale.value.total / sale.value.subtotal : 1;
  let sum = 0;

  sale.value.items.forEach((line, index) => {
    sum += Math.round(line.unitPrice * (Number(returnQuantities[index]) || 0) * ratio);
  });

  return sum;
});

async function saveReturn() {
  saving.value = true;

  try {
    const lines = [];

    sale.value.items.forEach((line, index) => {
      const quantity = Number(returnQuantities[index]) || 0;

      if (quantity > 0) {
        lines.push({ lineIndex: index, quantity });
      }
    });

    await api.post('/returns', {
      saleId: sale.value._id,
      items: lines,
      refundMethod: refundMethod.value,
      reason: reason.value,
    });

    toast.success('Qaytarish saqlandi');

    await openSale(sale.value._id);
    await load();
  } catch (error) {
    toast.error(error.message);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <h1>Sotuvlar</h1>
    </div>

    <div class="toolbar">
      <div class="field">
        <label>Sanadan</label>
        <input v-model="from" type="date" @change="search" />
      </div>
      <div class="field">
        <label>Sanagacha</label>
        <input v-model="to" type="date" @change="search" />
      </div>
      <div class="field">
        <label>Chek raqami</label>
        <input v-model="searchText" type="search" @keydown.enter="search" />
      </div>
      <button class="btn" type="button" @click="search">Qidirish</button>
    </div>

    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th>Chek</th>
            <th>Vaqt</th>
            <th v-if="!auth.branchId">Filial</th>
            <th>Kassir</th>
            <th>Mijoz</th>
            <th>To'lov</th>
            <th class="num">Jami</th>
            <th>Holati</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item._id" class="clickable" @click="openSale(item._id)">
            <td>{{ item.number }}</td>
            <td>{{ formatDateTime(item.createdAt) }}</td>
            <td v-if="!auth.branchId">{{ item.branch ? item.branch.name : '-' }}</td>
            <td>{{ item.cashier ? item.cashier.fullName : '-' }}</td>
            <td>{{ item.customer ? item.customer.name : '-' }}</td>
            <td>{{ paymentText(item) }}</td>
            <td class="num">{{ formatNumber(item.total) }}</td>
            <td>
              <span class="badge" :class="statusClass(item.status)">{{ SALE_STATUS_LABELS[item.status] }}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="items.length === 0" class="empty">Sotuv topilmadi</div>
    </div>

    <PagerBar :page="page" :limit="limit" :total="total" @change="changePage" />

    <ModalDialog v-if="sale" :title="'Chek ' + sale.number" wide @close="sale = null">
      <p class="muted">
        {{ formatDateTime(sale.createdAt) }} | {{ sale.branch.name }} | Kassir:
        {{ sale.cashier ? sale.cashier.fullName : '-' }}
        <span v-if="sale.customer"> | Mijoz: {{ sale.customer.name }}</span>
      </p>

      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Mahsulot</th>
              <th class="num">Miqdor</th>
              <th class="num">Narxi</th>
              <th class="num">Summa</th>
              <th class="num">Qaytarilgan</th>
              <th v-if="returnMode" style="width: 130px">Qaytarish miqdori</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(line, index) in sale.items" :key="index">
              <td>{{ line.name }}</td>
              <td class="num">{{ formatQty(line.quantity) }} {{ line.unitName }}</td>
              <td class="num">{{ formatNumber(line.unitPrice) }}</td>
              <td class="num">{{ formatNumber(line.lineTotal) }}</td>
              <td class="num">{{ formatQty(line.returnedQuantity) }}</td>
              <td v-if="returnMode">
                <input
                  v-model="returnQuantities[index]"
                  type="number"
                  min="0"
                  :max="canReturn(line)"
                  step="0.001"
                  :disabled="canReturn(line) <= 0"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="margin-top: 12px">
        <div>Mahsulotlar summasi: {{ formatMoney(sale.subtotal) }}</div>
        <div v-if="sale.discountAmount > 0">Chegirma: -{{ formatMoney(sale.discountAmount) }}</div>
        <h2>Jami: {{ formatMoney(sale.total) }}</h2>
        <div class="muted">{{ paymentText(sale) }}</div>
      </div>

      <div v-if="returnMode" class="panel" style="margin-top: 14px">
        <h3 style="margin-bottom: 10px">Tovarni qaytarish</h3>

        <div class="form-grid">
          <div class="field">
            <label>Pul qaytarish usuli</label>
            <select v-model="refundMethod">
              <option value="cash">Naqd</option>
              <option value="card">Karta</option>
              <option value="transfer">O'tkazma</option>
              <option v-if="sale.customer" value="debt">Mijozning qarzidan ayirish</option>
            </select>
          </div>

          <div class="field">
            <label>Sabab</label>
            <input v-model="reason" type="text" />
          </div>
        </div>

        <p>
          Qaytariladigan summa: <strong>{{ formatMoney(refundPreview) }}</strong>
        </p>
      </div>

      <template #footer>
        <button class="btn" type="button" @click="printStore.printReceipt(sale)">Chekni chop etish</button>

        <button
          v-if="!returnMode && sale.status !== 'returned'"
          class="btn"
          type="button"
          @click="startReturn"
        >
          Qaytarish
        </button>

        <button
          v-if="returnMode"
          class="btn btn-primary"
          type="button"
          :disabled="saving || refundPreview <= 0"
          @click="saveReturn"
        >
          Qaytarishni saqlash
        </button>
      </template>
    </ModalDialog>
  </div>
</template>
