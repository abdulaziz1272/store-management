<script setup>
// A search box for products.
//  - type a name or code and pick a result
//  - a barcode/QR scanner types the code and presses Enter: the product is found by its code
// It tells the parent which product was chosen:  @pick="addProduct"

import { onBeforeUnmount, ref, watch } from 'vue';

import { api } from '../lib/api';
import { formatMoney, formatQty } from '../lib/format';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';
import QrScanner from './QrScanner.vue';

const props = defineProps({
  placeholder: { type: String, default: "Mahsulot nomi yoki kodini yozing yoki skanerlang" },
  camera: { type: Boolean, default: false },
  autofocus: { type: Boolean, default: false },
});

const emit = defineEmits(['pick']);

const auth = useAuthStore();
const toast = useToastStore();

const inputRef = ref(null);
const text = ref('');
const results = ref([]);
const open = ref(false);
const showCamera = ref(false);

let timer = null;

// Wait a little after typing, then search (so we do not ask the server for every letter)
watch(text, (value) => {
  clearTimeout(timer);

  if (value.trim().length < 2) {
    results.value = [];
    return;
  }

  timer = setTimeout(async () => {
    try {
      const data = await api.get('/products', {
        search: value.trim(),
        active: '1',
        limit: 8,
        branch: auth.branchId,
      });

      results.value = data.items;
      open.value = true;
    } catch (error) {
      results.value = [];
    }
  }, 250);
});

onBeforeUnmount(() => {
  clearTimeout(timer);
});

function choose(product) {
  emit('pick', product);

  text.value = '';
  results.value = [];
  open.value = false;

  if (inputRef.value) {
    inputRef.value.focus();
  }
}

// Enter key: first try the text as an exact code (scanner), then the first search result
async function onEnter() {
  const value = text.value.trim();

  if (!value) {
    return;
  }

  try {
    const data = await api.get('/products/by-code/' + encodeURIComponent(value), {
      branch: auth.branchId,
    });

    choose(data.product);
    return;
  } catch (error) {
    // it was not an exact code, continue below
  }

  if (results.value.length > 0) {
    choose(results.value[0]);
    return;
  }

  toast.error('Mahsulot topilmadi');
}

async function onCameraScan(code) {
  showCamera.value = false;

  try {
    const data = await api.get('/products/by-code/' + encodeURIComponent(code), {
      branch: auth.branchId,
    });

    choose(data.product);
  } catch (error) {
    toast.error(error.message);
  }
}

function focusInput() {
  if (inputRef.value) {
    inputRef.value.focus();
  }
}

defineExpose({ focusInput });
</script>

<template>
  <div class="picker">
    <div style="display: flex; gap: 8px">
      <input
        ref="inputRef"
        v-model="text"
        type="search"
        :placeholder="props.placeholder"
        :autofocus="props.autofocus"
        autocomplete="off"
        @keydown.enter.prevent="onEnter"
        @focus="open = true"
        @blur="open = false"
      />

      <button v-if="props.camera" class="btn" type="button" @click="showCamera = true">Kamera</button>
    </div>

    <div v-if="open && results.length > 0" class="picker-results">
      <div v-for="product in results" :key="product._id" class="picker-item" @mousedown.prevent="choose(product)">
        <div>
          <strong>{{ product.name }}</strong>
          <div class="muted">{{ product.sku }}</div>
        </div>
        <div class="right">
          <div>{{ formatMoney(product.price) }}</div>
          <div class="muted">Qoldiq: {{ formatQty(product.stock) }} {{ product.baseUnit.name }}</div>
        </div>
      </div>
    </div>

    <QrScanner v-if="showCamera" @scan="onCameraScan" @close="showCamera = false" />
  </div>
</template>
