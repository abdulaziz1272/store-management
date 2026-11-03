<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import Papa from 'papaparse';

import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { useLookupsStore } from '../stores/lookups';
import { usePrintStore } from '../stores/print';
import { useToastStore } from '../stores/toast';
import { formatMoney, formatQty } from '../lib/format';
import ModalDialog from '../components/ModalDialog.vue';
import PagerBar from '../components/PagerBar.vue';

const auth = useAuthStore();
const lookups = useLookupsStore();
const printStore = usePrintStore();
const toast = useToastStore();

// ---------- List ----------
const items = ref([]);
const total = ref(0);
const page = ref(1);
const limit = 20;
const search = ref('');
const category = ref('');
const categories = ref([]);
const loading = ref(false);

async function load() {
  loading.value = true;

  try {
    const data = await api.get('/products', {
      page: page.value,
      limit,
      search: search.value,
      category: category.value,
      branch: auth.branchId,
    });

    items.value = data.items;
    total.value = data.total;
  } catch (error) {
    toast.error(error.message);
  } finally {
    loading.value = false;
  }
}

async function loadCategories() {
  try {
    const data = await api.get('/products/categories');
    categories.value = data.items;
  } catch (error) {
    categories.value = [];
  }
}

function changePage(newPage) {
  page.value = newPage;
  load();
}

function startSearch() {
  page.value = 1;
  load();
}

let searchTimer = null;

watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(startSearch, 300);
});

watch(() => auth.branchId, load);

onMounted(() => {
  load();
  loadCategories();
});

function isLow(product) {
  return product.minStock > 0 && product.stock < product.minStock;
}

// ---------- Create and edit ----------
const showForm = ref(false);
const editingId = ref(null);
const saving = ref(false);

const form = reactive({
  name: '',
  sku: '',
  category: '',
  baseUnit: '',
  altUnits: [],
  price: 0,
  costPrice: 0,
  minStock: 0,
  trackExpiry: false,
  isActive: true,
});

function openNew() {
  editingId.value = null;
  form.name = '';
  form.sku = '';
  form.category = '';
  form.baseUnit = lookups.units.length > 0 ? lookups.units[0]._id : '';
  form.altUnits = [];
  form.price = 0;
  form.costPrice = 0;
  form.minStock = 0;
  form.trackExpiry = false;
  form.isActive = true;
  showForm.value = true;
}

function openEdit(product) {
  editingId.value = product._id;
  form.name = product.name;
  form.sku = product.sku;
  form.category = product.category;
  form.baseUnit = product.baseUnit._id;
  form.altUnits = product.altUnits.map((alt) => ({ unit: alt.unit._id, factor: alt.factor }));
  form.price = product.price;
  form.costPrice = product.costPrice;
  form.minStock = product.minStock;
  form.trackExpiry = product.trackExpiry;
  form.isActive = product.isActive;
  showForm.value = true;
}

function addAltUnit() {
  form.altUnits.push({ unit: '', factor: 1 });
}

function removeAltUnit(index) {
  form.altUnits.splice(index, 1);
}

// The name of the base unit, shown in the alternative unit hint
const baseUnitName = computed(() => {
  const unit = lookups.units.find((item) => item._id === form.baseUnit);
  return unit ? unit.name : '';
});

async function save() {
  saving.value = true;

  try {
    const body = {
      name: form.name,
      category: form.category,
      baseUnit: form.baseUnit,
      altUnits: form.altUnits.filter((alt) => alt.unit && Number(alt.factor) > 0),
      price: Number(form.price),
      costPrice: Number(form.costPrice),
      minStock: Number(form.minStock),
      trackExpiry: form.trackExpiry,
      isActive: form.isActive,
    };

    if (editingId.value) {
      await api.put('/products/' + editingId.value, body);
    } else {
      body.sku = form.sku;
      await api.post('/products', body);
    }

    showForm.value = false;
    toast.success('Saqlandi');
    await load();
    await loadCategories();
  } catch (error) {
    toast.error(error.message);
  } finally {
    saving.value = false;
  }
}

// ---------- Stickers (labels) ----------
// The chosen products are kept here, even when you move to another page of the list.
const selected = ref({});
const showLabels = ref(false);

function toggleSelected(product) {
  const copy = { ...selected.value };

  if (copy[product._id]) {
    delete copy[product._id];
  } else {
    copy[product._id] = { product, copies: 1 };
  }

  selected.value = copy;
}

const selectedList = computed(() => Object.values(selected.value));

async function printSelectedLabels() {
  const labelItems = selectedList.value.map((entry) => ({
    sku: entry.product.sku,
    name: entry.product.name,
    price: entry.product.price,
    unit: entry.product.baseUnit.name,
    copies: Math.max(Number(entry.copies) || 1, 1),
  }));

  try {
    await printStore.printLabels(labelItems);
  } catch (error) {
    toast.error(error.message);
  }
}

// ---------- CSV import ----------
const showImport = ref(false);
const importRows = ref([]);
const importing = ref(false);
const importResult = ref(null);

function openImport() {
  importRows.value = [];
  importResult.value = null;
  showImport.value = true;
}

function onFileChosen(event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    complete: (result) => {
      importRows.value = result.data;
      importResult.value = null;
    },
    error: () => {
      toast.error("Faylni o'qib bo'lmadi");
    },
  });
}

// A small example file that shows the needed columns
function downloadTemplate() {
  const text = [
    'name,sku,category,unit,price,costPrice,minStock,quantity',
    'Sement M400 (50 kg),,Sement,qop,62000,55000,20,100',
    'Armatura 12 mm,,Metall,metr,9500,8000,100,500',
  ].join('\n');

  const blob = new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');

  link.href = URL.createObjectURL(blob);
  link.download = 'mahsulotlar-namuna.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// The file is sent in pieces of 200 rows, because a long request can be cut by the hosting
const IMPORT_CHUNK_SIZE = 200;

async function runImport() {
  importing.value = true;

  try {
    const summary = { created: 0, updated: 0, errors: [] };

    for (let start = 0; start < importRows.value.length; start += IMPORT_CHUNK_SIZE) {
      const piece = importRows.value.slice(start, start + IMPORT_CHUNK_SIZE);

      const result = await api.post('/products/import', {
        rows: piece,
        branchId: auth.branchId,
        rowOffset: start,
      });

      summary.created += result.created;
      summary.updated += result.updated;
      summary.errors.push(...result.errors);
    }

    importResult.value = summary;

    toast.success('Import tugadi');
    await load();
    await loadCategories();
  } catch (error) {
    toast.error(error.message);
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <h1>Mahsulotlar</h1>

      <div style="display: flex; gap: 8px; flex-wrap: wrap">
        <button class="btn" type="button" :disabled="selectedList.length === 0" @click="showLabels = true">
          Yorliq chop etish ({{ selectedList.length }})
        </button>
        <button v-if="auth.canManage" class="btn" type="button" @click="openImport">Import (CSV)</button>
        <button v-if="auth.canManage" class="btn btn-primary" type="button" @click="openNew">Yangi mahsulot</button>
      </div>
    </div>

    <div class="toolbar">
      <div class="field" style="min-width: 260px">
        <label>Qidirish</label>
        <input v-model="search" type="search" placeholder="Nomi, kodi yoki kategoriyasi" />
      </div>

      <div class="field">
        <label>Kategoriya</label>
        <select v-model="category" @change="startSearch">
          <option value="">Hammasi</option>
          <option v-for="name in categories" :key="name" :value="name">{{ name }}</option>
        </select>
      </div>
    </div>

    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th></th>
            <th>Kodi</th>
            <th>Nomi</th>
            <th>Kategoriya</th>
            <th>Birlik</th>
            <th class="num">Narxi</th>
            <th v-if="auth.canManage" class="num">Tannarxi</th>
            <th class="num">Qoldiq</th>
            <th v-if="auth.canManage"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in items" :key="product._id" :class="{ low: isLow(product) }">
            <td>
              <input
                type="checkbox"
                :checked="Boolean(selected[product._id])"
                :aria-label="'Yorliq uchun tanlash: ' + product.name"
                @change="toggleSelected(product)"
              />
            </td>
            <td>{{ product.sku }}</td>
            <td>
              {{ product.name }}
              <span v-if="!product.isActive" class="badge badge-bad">Faol emas</span>
            </td>
            <td>{{ product.category }}</td>
            <td>{{ product.baseUnit.name }}</td>
            <td class="num">{{ formatMoney(product.price) }}</td>
            <td v-if="auth.canManage" class="num">{{ formatMoney(product.costPrice) }}</td>
            <td class="num">{{ formatQty(product.stock) }}</td>
            <td v-if="auth.canManage" class="right">
              <button class="btn btn-small" type="button" @click="openEdit(product)">Tahrirlash</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="!loading && items.length === 0" class="empty">Mahsulot topilmadi</div>
    </div>

    <PagerBar :page="page" :limit="limit" :total="total" @change="changePage" />

    <!-- Create / edit -->
    <ModalDialog v-if="showForm" :title="editingId ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot'" wide @close="showForm = false">
      <div class="form-grid">
        <div class="field">
          <label>Nomi</label>
          <input v-model="form.name" type="text" />
        </div>

        <div class="field">
          <label>Kodi (QR kod ichidagi matn)</label>
          <input
            v-model="form.sku"
            type="text"
            :disabled="Boolean(editingId)"
            :placeholder="editingId ? '' : 'Bo\'sh qoldirsangiz avtomatik beriladi'"
          />
        </div>

        <div class="field">
          <label>Kategoriya</label>
          <input v-model="form.category" type="text" list="category-list" />
          <datalist id="category-list">
            <option v-for="name in categories" :key="name" :value="name"></option>
          </datalist>
        </div>

        <div class="field">
          <label>Asosiy o'lchov birligi</label>
          <select v-model="form.baseUnit">
            <option v-for="unit in lookups.units" :key="unit._id" :value="unit._id">{{ unit.name }}</option>
          </select>
        </div>

        <div class="field">
          <label>Sotuv narxi (1 {{ baseUnitName }} uchun, so'm)</label>
          <input v-model="form.price" type="number" min="0" step="1" />
        </div>

        <div class="field">
          <label>Tannarxi (1 {{ baseUnitName }} uchun, so'm)</label>
          <input v-model="form.costPrice" type="number" min="0" step="0.01" />
        </div>

        <div class="field">
          <label>Minimal qoldiq ({{ baseUnitName }})</label>
          <input v-model="form.minStock" type="number" min="0" step="0.001" />
        </div>

        <label class="check" style="align-self: end">
          <input v-model="form.trackExpiry" type="checkbox" />
          Yaroqlilik muddati kuzatiladi
        </label>

        <label v-if="editingId" class="check" style="align-self: end">
          <input v-model="form.isActive" type="checkbox" />
          Faol
        </label>
      </div>

      <h3 style="margin: 18px 0 8px">Qo'shimcha o'lchov birliklari</h3>
      <p class="muted" style="margin-top: 0">
        Masalan: 1 qop = 50 kg bo'lsa, birlik "qop" va koeffitsient 50 deb yoziladi.
      </p>

      <div v-for="(alt, index) in form.altUnits" :key="index" class="form-grid" style="margin-bottom: 8px">
        <div class="field">
          <select v-model="alt.unit">
            <option value="">Birlikni tanlang</option>
            <option v-for="unit in lookups.units" :key="unit._id" :value="unit._id">{{ unit.name }}</option>
          </select>
        </div>
        <div class="field">
          <input v-model="alt.factor" type="number" min="0" step="0.001" :placeholder="'1 birlik = ? ' + baseUnitName" />
        </div>
        <div>
          <button class="btn btn-small btn-danger" type="button" @click="removeAltUnit(index)">O'chirish</button>
        </div>
      </div>

      <button class="btn btn-small" type="button" @click="addAltUnit">Birlik qo'shish</button>

      <template #footer>
        <button class="btn" type="button" @click="showForm = false">Bekor qilish</button>
        <button class="btn btn-primary" type="button" :disabled="saving" @click="save">Saqlash</button>
      </template>
    </ModalDialog>

    <!-- Labels -->
    <ModalDialog v-if="showLabels" title="Yorliq (stiker) chop etish: 40 x 30 mm" @close="showLabels = false">
      <table class="data">
        <thead>
          <tr>
            <th>Mahsulot</th>
            <th>Nusxa soni</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in selectedList" :key="entry.product._id">
            <td>{{ entry.product.name }}<div class="muted">{{ entry.product.sku }}</div></td>
            <td style="width: 110px">
              <input v-model="entry.copies" type="number" min="1" step="1" />
            </td>
            <td class="right">
              <button class="btn btn-small" type="button" @click="toggleSelected(entry.product)">Olib tashlash</button>
            </td>
          </tr>
        </tbody>
      </table>

      <p class="muted">
        Chop etish oynasida stiker printerini tanlang. Qog'oz o'lchami 40 x 30 mm avtomatik o'rnatiladi.
      </p>

      <template #footer>
        <button class="btn" type="button" @click="showLabels = false">Yopish</button>
        <button class="btn btn-primary" type="button" :disabled="selectedList.length === 0" @click="printSelectedLabels">
          Chop etish
        </button>
      </template>
    </ModalDialog>

    <!-- Import -->
    <ModalDialog v-if="showImport" title="Mahsulotlarni CSV fayldan import qilish" wide @close="showImport = false">
      <p>
        Excel faylingizni "CSV" formatida saqlang va shu yerga yuklang. Kerakli ustunlar:
        <strong>name, sku, category, unit, price, costPrice, minStock, quantity</strong>.
        "sku" bo'sh bo'lsa kod avtomatik beriladi. "sku" mavjud bo'lsa mahsulot yangilanadi.
      </p>

      <p v-if="auth.isAdmin && !auth.branchId" class="error-text">
        "quantity" (boshlang'ich qoldiq) ustuni ishlashi uchun yuqoridan filialni tanlang.
      </p>

      <div style="display: flex; gap: 10px; align-items: center; margin: 12px 0">
        <input type="file" accept=".csv,text/csv" @change="onFileChosen" />
        <button class="btn btn-small" type="button" @click="downloadTemplate">Namuna faylni yuklab olish</button>
      </div>

      <div v-if="importRows.length > 0">
        <p>
          Fayldagi qatorlar: <strong>{{ importRows.length }}</strong>. Dastlabki 5 tasi:
        </p>

        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th v-for="key in Object.keys(importRows[0])" :key="key">{{ key }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in importRows.slice(0, 5)" :key="index">
                <td v-for="key in Object.keys(importRows[0])" :key="key">{{ row[key] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div v-if="importResult" style="margin-top: 14px">
        <p>
          Yangi: <strong>{{ importResult.created }}</strong>, yangilandi: <strong>{{ importResult.updated }}</strong>,
          xatolar: <strong>{{ importResult.errors.length }}</strong>
        </p>
        <ul v-if="importResult.errors.length > 0">
          <li v-for="(item, index) in importResult.errors.slice(0, 30)" :key="index" class="error-text">
            {{ item.row }}-qator: {{ item.message }}
          </li>
        </ul>
      </div>

      <template #footer>
        <button class="btn" type="button" @click="showImport = false">Yopish</button>
        <button class="btn btn-primary" type="button" :disabled="importing || importRows.length === 0" @click="runImport">
          Import qilish
        </button>
      </template>
    </ModalDialog>
  </div>
</template>
