<script setup>
import { computed, onMounted, ref, watch } from 'vue';

import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { useLookupsStore } from '../stores/lookups';
import { useToastStore } from '../stores/toast';
import { daysAgoString, formatDate, formatDateTime, formatMoney, formatNumber, formatQty, todayString } from '../lib/format';
import ModalDialog from '../components/ModalDialog.vue';
import PagerBar from '../components/PagerBar.vue';
import ProductPicker from '../components/ProductPicker.vue';

const auth = useAuthStore();
const lookups = useLookupsStore();
const toast = useToastStore();

// ---------- List ----------
const items = ref([]);
const total = ref(0);
const page = ref(1);
const limit = 20;
const from = ref(daysAgoString(30));
const to = ref(todayString());
const openedId = ref('');

async function load() {
  try {
    const data = await api.get('/purchases', {
      page: page.value,
      limit,
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

function toggleOpen(id) {
  openedId.value = openedId.value === id ? '' : id;
}

// ---------- New purchase ----------
const showForm = ref(false);
const saving = ref(false);
const supplierId = ref('');
const note = ref('');
const rows = ref([]);

function openNew() {
  supplierId.value = '';
  note.value = '';
  rows.value = [];
  showForm.value = true;
}

// Units a product can be received in: the base unit and the alternative units
function unitOptions(product) {
  const options = [{ id: product.baseUnit._id, name: product.baseUnit.name, factor: 1 }];

  for (const alt of product.altUnits) {
    options.push({ id: alt.unit._id, name: alt.unit.name, factor: alt.factor });
  }

  return options;
}

function factorOf(row) {
  const option = unitOptions(row.product).find((item) => item.id === row.unitId);
  return option ? option.factor : 1;
}

function addRow(product) {
  rows.value.push({
    product,
    unitId: product.baseUnit._id,
    quantity: 1,
    unitCost: product.costPrice,
    batchNumber: '',
    expiryDate: '',
  });
}

function onUnitChange(row) {
  // The cost is per ONE chosen unit: base cost x factor
  row.unitCost = Math.round(row.product.costPrice * factorOf(row) * 100) / 100;
}

function removeRow(index) {
  rows.value.splice(index, 1);
}

function rowTotal(row) {
  return Math.round((Number(row.unitCost) || 0) * (Number(row.quantity) || 0));
}

const grandTotal = computed(() => {
  return rows.value.reduce((sum, row) => sum + rowTotal(row), 0);
});

async function save() {
  saving.value = true;

  try {
    await api.post('/purchases', {
      branchId: auth.branchId,
      supplierId: supplierId.value || undefined,
      note: note.value,
      items: rows.value.map((row) => ({
        productId: row.product._id,
        unitId: row.unitId,
        quantity: Number(row.quantity),
        unitCost: Number(row.unitCost),
        batchNumber: row.batchNumber,
        expiryDate: row.expiryDate,
      })),
    });

    showForm.value = false;
    toast.success('Kirim saqlandi');
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
      <h1>Kirim (qabul qilingan tovar)</h1>
      <button class="btn btn-primary" type="button" :disabled="!auth.branchId" @click="openNew">Yangi kirim</button>
    </div>

    <p v-if="!auth.branchId" class="error-text" style="margin-bottom: 12px">
      Yangi kirim qilish uchun yuqoridan filialni tanlang.
    </p>

    <div class="toolbar">
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
            <th>Raqam</th>
            <th>Sana</th>
            <th>Filial</th>
            <th>Yetkazib beruvchi</th>
            <th>Xodim</th>
            <th class="num">Summa</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="purchase in items" :key="purchase._id">
            <tr class="clickable" @click="toggleOpen(purchase._id)">
              <td>{{ purchase.number }}</td>
              <td>{{ formatDateTime(purchase.createdAt) }}</td>
              <td>{{ purchase.branch ? purchase.branch.name : '-' }}</td>
              <td>{{ purchase.supplier ? purchase.supplier.name : '-' }}</td>
              <td>{{ purchase.user ? purchase.user.fullName : '-' }}</td>
              <td class="num">{{ formatMoney(purchase.totalCost) }}</td>
            </tr>

            <tr v-if="openedId === purchase._id">
              <td colspan="6">
                <table class="data">
                  <thead>
                    <tr>
                      <th>Mahsulot</th>
                      <th class="num">Miqdor</th>
                      <th class="num">Narxi</th>
                      <th>Partiya</th>
                      <th>Muddati</th>
                      <th class="num">Summa</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(line, index) in purchase.items" :key="index">
                      <td>{{ line.name }}</td>
                      <td class="num">{{ formatQty(line.quantity) }} {{ line.unitName }}</td>
                      <td class="num">{{ formatNumber(line.unitCost) }}</td>
                      <td>{{ line.batchNumber }}</td>
                      <td>{{ line.expiryDate ? formatDate(line.expiryDate) : '-' }}</td>
                      <td class="num">{{ formatNumber(line.lineTotal) }}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <div v-if="items.length === 0" class="empty">Kirim topilmadi</div>
    </div>

    <PagerBar :page="page" :limit="limit" :total="total" @change="changePage" />

    <ModalDialog v-if="showForm" title="Yangi kirim" wide @close="showForm = false">
      <div class="form-grid" style="margin-bottom: 14px">
        <div class="field">
          <label>Yetkazib beruvchi</label>
          <select v-model="supplierId">
            <option value="">Tanlanmagan</option>
            <option v-for="supplier in lookups.suppliers" :key="supplier._id" :value="supplier._id">
              {{ supplier.name }}
            </option>
          </select>
        </div>

        <div class="field">
          <label>Izoh</label>
          <input v-model="note" type="text" />
        </div>
      </div>

      <ProductPicker @pick="addRow" />

      <div class="table-wrap" style="margin-top: 12px">
        <table class="data">
          <thead>
            <tr>
              <th>Mahsulot</th>
              <th>Birlik</th>
              <th>Miqdor</th>
              <th>Narxi (1 birlik)</th>
              <th>Partiya raqami</th>
              <th>Yaroqlilik muddati</th>
              <th class="num">Summa</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in rows" :key="index">
              <td>{{ row.product.name }}</td>
              <td style="width: 110px">
                <select v-model="row.unitId" @change="onUnitChange(row)">
                  <option v-for="option in unitOptions(row.product)" :key="option.id" :value="option.id">
                    {{ option.name }}
                  </option>
                </select>
              </td>
              <td style="width: 100px"><input v-model="row.quantity" type="number" min="0" step="0.001" /></td>
              <td style="width: 130px"><input v-model="row.unitCost" type="number" min="0" step="0.01" /></td>
              <td style="width: 130px"><input v-model="row.batchNumber" type="text" placeholder="-" /></td>
              <td style="width: 160px">
                <input v-model="row.expiryDate" type="date" :required="row.product.trackExpiry" />
                <div v-if="row.product.trackExpiry" class="muted">Majburiy</div>
              </td>
              <td class="num">{{ formatNumber(rowTotal(row)) }}</td>
              <td><button class="btn btn-small btn-danger" type="button" @click="removeRow(index)">X</button></td>
            </tr>
          </tbody>
        </table>

        <div v-if="rows.length === 0" class="empty">Yuqoridan mahsulot qidirib qo'shing</div>
      </div>

      <h2 class="right" style="margin-top: 12px">Jami: {{ formatMoney(grandTotal) }}</h2>

      <template #footer>
        <button class="btn" type="button" @click="showForm = false">Bekor qilish</button>
        <button class="btn btn-primary" type="button" :disabled="saving || rows.length === 0" @click="save">
          Saqlash
        </button>
      </template>
    </ModalDialog>
  </div>
</template>
