<script setup>
import { computed, onMounted, ref, watch } from 'vue';

import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { useLookupsStore } from '../stores/lookups';
import { useToastStore } from '../stores/toast';
import { daysAgoString, formatDateTime, formatQty, todayString } from '../lib/format';
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

async function load() {
  try {
    const data = await api.get('/transfers', {
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

// ---------- New transfer ----------
const showForm = ref(false);
const saving = ref(false);
const toBranchId = ref('');
const note = ref('');
const rows = ref([]);

// The goods go to a different, active branch
const targetBranches = computed(() => {
  return lookups.branches.filter((branch) => branch.isActive && branch._id !== auth.branchId);
});

const fromBranchName = computed(() => {
  const branch = lookups.branches.find((item) => item._id === auth.branchId);
  return branch ? branch.name : '';
});

function openNew() {
  toBranchId.value = '';
  note.value = '';
  rows.value = [];
  showForm.value = true;
}

function unitOptions(product) {
  const options = [{ id: product.baseUnit._id, name: product.baseUnit.name }];

  for (const alt of product.altUnits) {
    options.push({ id: alt.unit._id, name: alt.unit.name });
  }

  return options;
}

function addRow(product) {
  rows.value.push({ product, unitId: product.baseUnit._id, quantity: 1 });
}

function removeRow(index) {
  rows.value.splice(index, 1);
}

async function save() {
  saving.value = true;

  try {
    await api.post('/transfers', {
      fromBranchId: auth.branchId,
      toBranchId: toBranchId.value,
      note: note.value,
      items: rows.value.map((row) => ({
        productId: row.product._id,
        unitId: row.unitId,
        quantity: Number(row.quantity),
      })),
    });

    showForm.value = false;
    toast.success("Ko'chirish bajarildi");
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
      <h1>Filiallararo ko'chirish</h1>
      <button class="btn btn-primary" type="button" :disabled="!auth.branchId" @click="openNew">
        Yangi ko'chirish
      </button>
    </div>

    <p v-if="!auth.branchId" class="error-text" style="margin-bottom: 12px">
      Ko'chirish uchun yuqoridan jo'natuvchi filialni tanlang.
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
            <th>Qayerdan</th>
            <th>Qayerga</th>
            <th>Xodim</th>
            <th>Mahsulotlar</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="transfer in items" :key="transfer._id">
            <td>{{ transfer.number }}</td>
            <td>{{ formatDateTime(transfer.createdAt) }}</td>
            <td>{{ transfer.fromBranch ? transfer.fromBranch.name : '-' }}</td>
            <td>{{ transfer.toBranch ? transfer.toBranch.name : '-' }}</td>
            <td>{{ transfer.user ? transfer.user.fullName : '-' }}</td>
            <td style="white-space: pre-line">
              {{ transfer.items.map((line) => line.name + ' x ' + formatQty(line.baseQuantity) + ' ' + line.unitName).join('\n') }}
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="items.length === 0" class="empty">Ko'chirish topilmadi</div>
    </div>

    <PagerBar :page="page" :limit="limit" :total="total" @change="changePage" />

    <ModalDialog v-if="showForm" title="Yangi ko'chirish" wide @close="showForm = false">
      <div class="form-grid" style="margin-bottom: 14px">
        <div class="field">
          <label>Qayerdan</label>
          <input type="text" :value="fromBranchName" disabled />
        </div>

        <div class="field">
          <label>Qayerga</label>
          <select v-model="toBranchId">
            <option value="">Filialni tanlang</option>
            <option v-for="branch in targetBranches" :key="branch._id" :value="branch._id">{{ branch.name }}</option>
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
              <th class="num">Mavjud</th>
              <th>Birlik</th>
              <th>Miqdor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in rows" :key="index">
              <td>{{ row.product.name }}</td>
              <td class="num">{{ formatQty(row.product.stock) }} {{ row.product.baseUnit.name }}</td>
              <td style="width: 120px">
                <select v-model="row.unitId">
                  <option v-for="option in unitOptions(row.product)" :key="option.id" :value="option.id">
                    {{ option.name }}
                  </option>
                </select>
              </td>
              <td style="width: 120px"><input v-model="row.quantity" type="number" min="0" step="0.001" /></td>
              <td><button class="btn btn-small btn-danger" type="button" @click="removeRow(index)">X</button></td>
            </tr>
          </tbody>
        </table>

        <div v-if="rows.length === 0" class="empty">Yuqoridan mahsulot qidirib qo'shing</div>
      </div>

      <p class="muted">Yaroqlilik muddati tugagan tovarlar ko'chirilmaydi. Avval muddati yaqin tovarlar ko'chiriladi.</p>

      <template #footer>
        <button class="btn" type="button" @click="showForm = false">Bekor qilish</button>
        <button class="btn btn-primary" type="button" :disabled="saving || rows.length === 0 || !toBranchId" @click="save">
          Ko'chirish
        </button>
      </template>
    </ModalDialog>
  </div>
</template>
