<script setup>
import { onMounted, reactive, ref, watch } from 'vue';

import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';
import { formatDateTime, formatMoney, formatNumber } from '../lib/format';
import { PAYMENT_LABELS } from '../lib/labels';
import ModalDialog from '../components/ModalDialog.vue';
import PagerBar from '../components/PagerBar.vue';

const auth = useAuthStore();
const toast = useToastStore();

// ---------- List ----------
const items = ref([]);
const total = ref(0);
const page = ref(1);
const limit = 20;
const searchText = ref('');
const onlyDebt = ref(false);

async function load() {
  try {
    const data = await api.get('/customers', {
      page: page.value,
      limit,
      search: searchText.value,
      withDebt: onlyDebt.value ? '1' : '',
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

let timer = null;

watch(searchText, () => {
  clearTimeout(timer);
  timer = setTimeout(search, 300);
});

onMounted(load);

// ---------- Create and edit ----------
const showForm = ref(false);
const editingId = ref(null);
const saving = ref(false);
const form = reactive({ name: '', phone: '', address: '', note: '', isActive: true });

function openNew() {
  editingId.value = null;
  form.name = '';
  form.phone = '';
  form.address = '';
  form.note = '';
  form.isActive = true;
  showForm.value = true;
}

function openEdit(customer) {
  editingId.value = customer._id;
  form.name = customer.name;
  form.phone = customer.phone;
  form.address = customer.address;
  form.note = customer.note;
  form.isActive = customer.isActive;
  showForm.value = true;
}

async function save() {
  saving.value = true;

  try {
    if (editingId.value) {
      await api.put('/customers/' + editingId.value, { ...form });
    } else {
      await api.post('/customers', { ...form });
    }

    showForm.value = false;
    toast.success('Saqlandi');
    await load();
  } catch (error) {
    toast.error(error.message);
  } finally {
    saving.value = false;
  }
}

// ---------- Debt history ----------
const showLedger = ref(false);
const ledger = ref([]);
const ledgerCustomer = ref(null);

const TYPE_LABELS = { sale: 'Nasiya sotuv', payment: "Qarz to'lovi", return: 'Qaytarish' };

async function openLedger(customer) {
  ledgerCustomer.value = customer;

  try {
    const data = await api.get('/customers/' + customer._id + '/ledger');
    ledger.value = data.items;
    showLedger.value = true;
  } catch (error) {
    toast.error(error.message);
  }
}

// ---------- Debt payment ----------
const showPayment = ref(false);
const paymentCustomer = ref(null);
const paymentAmount = ref('');
const paymentMethod = ref('cash');
const paymentNote = ref('');

function openPayment(customer) {
  if (!auth.branchId) {
    toast.error("To'lovni qabul qilish uchun yuqoridan filialni tanlang");
    return;
  }

  paymentCustomer.value = customer;
  paymentAmount.value = customer.debt;
  paymentMethod.value = 'cash';
  paymentNote.value = '';
  showPayment.value = true;
}

async function savePayment() {
  saving.value = true;

  try {
    await api.post('/customers/' + paymentCustomer.value._id + '/payments', {
      amount: Number(paymentAmount.value),
      method: paymentMethod.value,
      note: paymentNote.value,
      branchId: auth.branchId,
    });

    showPayment.value = false;
    toast.success("To'lov qabul qilindi");
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
      <h1>Mijozlar va qarzlar</h1>
      <button class="btn btn-primary" type="button" @click="openNew">Yangi mijoz</button>
    </div>

    <div class="toolbar">
      <div class="field" style="min-width: 260px">
        <label>Qidirish</label>
        <input v-model="searchText" type="search" placeholder="Ismi yoki telefoni" />
      </div>

      <label class="check" style="padding-bottom: 8px">
        <input v-model="onlyDebt" type="checkbox" @change="search" />
        Faqat qarzdorlar
      </label>
    </div>

    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th>Ismi</th>
            <th>Telefon</th>
            <th>Manzil</th>
            <th class="num">Qarzi</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="customer in items" :key="customer._id">
            <td>
              {{ customer.name }}
              <span v-if="!customer.isActive" class="badge badge-bad">Faol emas</span>
            </td>
            <td>{{ customer.phone }}</td>
            <td>{{ customer.address }}</td>
            <td class="num">
              <strong :style="{ color: customer.debt > 0 ? 'var(--danger)' : 'inherit' }">
                {{ formatMoney(customer.debt) }}
              </strong>
            </td>
            <td class="right" style="white-space: nowrap">
              <button class="btn btn-small" type="button" @click="openLedger(customer)">Tarix</button>
              <button v-if="customer.debt > 0" class="btn btn-small" type="button" @click="openPayment(customer)">
                To'lov
              </button>
              <button v-if="auth.canManage" class="btn btn-small" type="button" @click="openEdit(customer)">
                Tahrirlash
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="items.length === 0" class="empty">Mijoz topilmadi</div>
    </div>

    <PagerBar :page="page" :limit="limit" :total="total" @change="changePage" />

    <ModalDialog v-if="showForm" :title="editingId ? 'Mijozni tahrirlash' : 'Yangi mijoz'" @close="showForm = false">
      <div class="form-grid">
        <div class="field">
          <label>Ismi</label>
          <input v-model="form.name" type="text" />
        </div>
        <div class="field">
          <label>Telefon</label>
          <input v-model="form.phone" type="text" />
        </div>
        <div class="field">
          <label>Manzil</label>
          <input v-model="form.address" type="text" />
        </div>
        <div class="field">
          <label>Izoh</label>
          <input v-model="form.note" type="text" />
        </div>
        <label v-if="editingId" class="check">
          <input v-model="form.isActive" type="checkbox" />
          Faol
        </label>
      </div>

      <template #footer>
        <button class="btn" type="button" @click="showForm = false">Bekor qilish</button>
        <button class="btn btn-primary" type="button" :disabled="saving || !form.name.trim()" @click="save">
          Saqlash
        </button>
      </template>
    </ModalDialog>

    <ModalDialog v-if="showLedger" :title="'Qarz tarixi: ' + ledgerCustomer.name" wide @close="showLedger = false">
      <div class="table-wrap">
        <table class="data">
          <thead>
            <tr>
              <th>Vaqt</th>
              <th>Turi</th>
              <th>Hujjat</th>
              <th>Filial</th>
              <th class="num">Summa</th>
              <th class="num">Qoldi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in ledger" :key="entry._id">
              <td>{{ formatDateTime(entry.createdAt) }}</td>
              <td>
                {{ TYPE_LABELS[entry.type] }}
                <span v-if="entry.method"> ({{ PAYMENT_LABELS[entry.method] }})</span>
              </td>
              <td>{{ entry.refNumber }}</td>
              <td>{{ entry.branch ? entry.branch.name : '-' }}</td>
              <td class="num">{{ entry.amount > 0 ? '+' : '' }}{{ formatNumber(entry.amount) }}</td>
              <td class="num">{{ formatNumber(entry.balanceAfter) }}</td>
            </tr>
          </tbody>
        </table>

        <div v-if="ledger.length === 0" class="empty">Tarix yo'q</div>
      </div>
    </ModalDialog>

    <ModalDialog v-if="showPayment" :title="'Qarz to\'lovi: ' + paymentCustomer.name" @close="showPayment = false">
      <p>
        Joriy qarz: <strong>{{ formatMoney(paymentCustomer.debt) }}</strong>
      </p>

      <div class="form-grid">
        <div class="field">
          <label>Summa (so'm)</label>
          <input v-model="paymentAmount" type="number" min="1" :max="paymentCustomer.debt" />
        </div>

        <div class="field">
          <label>To'lov usuli</label>
          <select v-model="paymentMethod">
            <option value="cash">Naqd</option>
            <option value="card">Karta</option>
            <option value="transfer">O'tkazma</option>
          </select>
        </div>

        <div class="field">
          <label>Izoh</label>
          <input v-model="paymentNote" type="text" />
        </div>
      </div>

      <template #footer>
        <button class="btn" type="button" @click="showPayment = false">Bekor qilish</button>
        <button class="btn btn-primary" type="button" :disabled="saving || !paymentAmount" @click="savePayment">
          Qabul qilish
        </button>
      </template>
    </ModalDialog>
  </div>
</template>
