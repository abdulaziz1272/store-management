<script setup>
// A ready-made page for simple lists (branches, units, suppliers):
// a table, and a window to add or edit a record.

import { onMounted, reactive, ref } from 'vue';

import { api } from '../lib/api';
import { useLookupsStore } from '../stores/lookups';
import { useToastStore } from '../stores/toast';
import ModalDialog from './ModalDialog.vue';

const props = defineProps({
  title: { type: String, required: true },
  endpoint: { type: String, required: true },
  // [{ key: 'name', label: 'Nomi', bool: false }]
  columns: { type: Array, required: true },
  // [{ key: 'name', label: 'Nomi', type: 'text' | 'checkbox' }]
  fields: { type: Array, required: true },
  canWrite: { type: Boolean, default: true },
  hasActive: { type: Boolean, default: true },
  // which shared list must be refreshed after saving: 'branches', 'units' or 'suppliers'
  lookup: { type: String, default: '' },
});

const lookups = useLookupsStore();
const toast = useToastStore();

const items = ref([]);
const loading = ref(false);
const showForm = ref(false);
const editingId = ref(null);
const saving = ref(false);
const form = reactive({});

async function load() {
  loading.value = true;

  try {
    const data = await api.get(props.endpoint);
    items.value = data.items;
  } catch (error) {
    toast.error(error.message);
  } finally {
    loading.value = false;
  }
}

function fillForm(item) {
  for (const field of props.fields) {
    if (field.type === 'checkbox') {
      form[field.key] = item ? Boolean(item[field.key]) : false;
    } else {
      form[field.key] = item ? item[field.key] || '' : '';
    }
  }

  form.isActive = item ? item.isActive !== false : true;
}

function openNew() {
  editingId.value = null;
  fillForm(null);
  showForm.value = true;
}

function openEdit(item) {
  editingId.value = item._id;
  fillForm(item);
  showForm.value = true;
}

async function save() {
  saving.value = true;

  try {
    if (editingId.value) {
      await api.put(props.endpoint + '/' + editingId.value, { ...form });
    } else {
      await api.post(props.endpoint, { ...form });
    }

    showForm.value = false;
    toast.success('Saqlandi');

    await load();

    if (props.lookup === 'branches') {
      await lookups.loadBranches();
    }

    if (props.lookup === 'units') {
      await lookups.loadUnits();
    }

    if (props.lookup === 'suppliers') {
      await lookups.loadSuppliers();
    }
  } catch (error) {
    toast.error(error.message);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="page-head">
      <h1>{{ props.title }}</h1>
      <button v-if="props.canWrite" class="btn btn-primary" type="button" @click="openNew">Qo'shish</button>
    </div>

    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th v-for="column in props.columns" :key="column.key">{{ column.label }}</th>
            <th v-if="props.hasActive">Holati</th>
            <th v-if="props.canWrite"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item._id">
            <td v-for="column in props.columns" :key="column.key">
              <span v-if="column.bool">{{ item[column.key] ? 'Ha' : "Yo'q" }}</span>
              <span v-else>{{ item[column.key] }}</span>
            </td>
            <td v-if="props.hasActive">
              <span class="badge" :class="item.isActive ? 'badge-ok' : 'badge-bad'">
                {{ item.isActive ? 'Faol' : 'Faol emas' }}
              </span>
            </td>
            <td v-if="props.canWrite" class="right">
              <button class="btn btn-small" type="button" @click="openEdit(item)">Tahrirlash</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="!loading && items.length === 0" class="empty">Hozircha ma'lumot yo'q</div>
    </div>

    <ModalDialog v-if="showForm" :title="editingId ? 'Tahrirlash' : 'Yangi yozuv'" @close="showForm = false">
      <div class="form-grid">
        <div v-for="field in props.fields" :key="field.key" class="field">
          <label v-if="field.type !== 'checkbox'">{{ field.label }}</label>
          <input v-if="field.type === 'text'" v-model="form[field.key]" type="text" />
          <label v-if="field.type === 'checkbox'" class="check">
            <input v-model="form[field.key]" type="checkbox" />
            {{ field.label }}
          </label>
        </div>

        <label v-if="props.hasActive && editingId" class="check">
          <input v-model="form.isActive" type="checkbox" />
          Faol
        </label>
      </div>

      <template #footer>
        <button class="btn" type="button" @click="showForm = false">Bekor qilish</button>
        <button class="btn btn-primary" type="button" :disabled="saving" @click="save">Saqlash</button>
      </template>
    </ModalDialog>
  </div>
</template>
