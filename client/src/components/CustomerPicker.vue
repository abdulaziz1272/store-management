<script setup>
// Choose a customer (or add a new one quickly). Use it with v-model:
//   <CustomerPicker v-model="customer" />

import { ref, watch } from 'vue';

import { api } from '../lib/api';
import { formatMoney } from '../lib/format';
import { useToastStore } from '../stores/toast';
import ModalDialog from './ModalDialog.vue';

const props = defineProps({
  modelValue: { type: Object, default: null },
});

const emit = defineEmits(['update:modelValue']);

const toast = useToastStore();

const text = ref('');
const results = ref([]);
const showNew = ref(false);
const newName = ref('');
const newPhone = ref('');
const saving = ref(false);

let timer = null;

watch(text, (value) => {
  clearTimeout(timer);

  if (value.trim().length < 2) {
    results.value = [];
    return;
  }

  timer = setTimeout(async () => {
    try {
      const data = await api.get('/customers', { search: value.trim(), limit: 8 });
      results.value = data.items;
    } catch (error) {
      results.value = [];
    }
  }, 250);
});

function choose(customer) {
  emit('update:modelValue', customer);
  text.value = '';
  results.value = [];
}

function clear() {
  emit('update:modelValue', null);
}

async function saveNew() {
  saving.value = true;

  try {
    const data = await api.post('/customers', { name: newName.value, phone: newPhone.value });
    choose(data.customer);
    showNew.value = false;
    newName.value = '';
    newPhone.value = '';
  } catch (error) {
    toast.error(error.message);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <div v-if="props.modelValue" style="display: flex; justify-content: space-between; align-items: center; gap: 8px">
      <div>
        <strong>{{ props.modelValue.name }}</strong>
        <div v-if="props.modelValue.phone">{{ props.modelValue.phone }}</div>
        <div v-if="props.modelValue.debt > 0" class="warn-text">Qarzi: {{ formatMoney(props.modelValue.debt) }}</div>
      </div>
      <button class="btn btn-small" type="button" @click="clear">Olib tashlash</button>
    </div>

    <div v-else class="picker">
      <div style="display: flex; gap: 8px">
        <input v-model="text" type="search" placeholder="Mijoz ismi yoki telefoni" autocomplete="off" />
        <button class="btn" type="button" @click="showNew = true">Yangi</button>
      </div>

      <div v-if="results.length > 0" class="picker-results" style="color: var(--ink)">
        <div v-for="customer in results" :key="customer._id" class="picker-item" @mousedown.prevent="choose(customer)">
          <div>
            <strong>{{ customer.name }}</strong>
            <div class="muted">{{ customer.phone }}</div>
          </div>
          <div v-if="customer.debt > 0" class="right muted">Qarz: {{ formatMoney(customer.debt) }}</div>
        </div>
      </div>
    </div>

    <ModalDialog v-if="showNew" title="Yangi mijoz" @close="showNew = false">
      <div class="form-grid">
        <div class="field" style="color: var(--ink)">
          <label>Ismi</label>
          <input v-model="newName" type="text" />
        </div>
        <div class="field" style="color: var(--ink)">
          <label>Telefon</label>
          <input v-model="newPhone" type="text" />
        </div>
      </div>

      <template #footer>
        <button class="btn" type="button" @click="showNew = false">Bekor qilish</button>
        <button class="btn btn-primary" type="button" :disabled="saving || !newName.trim()" @click="saveNew">
          Saqlash
        </button>
      </template>
    </ModalDialog>
  </div>
</template>
