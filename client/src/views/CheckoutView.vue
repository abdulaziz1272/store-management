<script setup>
// The checkout (cash register).
// Flow: scan or search products -> cart -> discount, customer, payment -> "Sotish" -> receipt

import { computed, reactive, ref } from 'vue';

import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { usePrintStore } from '../stores/print';
import { useToastStore } from '../stores/toast';
import { formatMoney, formatNumber, formatQty } from '../lib/format';
import { PAYMENT_LABELS } from '../lib/labels';
import CustomerPicker from '../components/CustomerPicker.vue';
import ModalDialog from '../components/ModalDialog.vue';
import ProductPicker from '../components/ProductPicker.vue';

const auth = useAuthStore();
const printStore = usePrintStore();
const toast = useToastStore();

const pickerRef = ref(null);

// ---------- Cart ----------
// A cart line: { product, unitId, quantity }
const cart = ref([]);

function unitOptions(product) {
  const options = [{ id: product.baseUnit._id, name: product.baseUnit.name, factor: 1, allowDecimal: product.baseUnit.allowDecimal }];

  for (const alt of product.altUnits) {
    options.push({ id: alt.unit._id, name: alt.unit.name, factor: alt.factor, allowDecimal: alt.unit.allowDecimal });
  }

  return options;
}

function optionOf(line) {
  const found = unitOptions(line.product).find((option) => option.id === line.unitId);
  return found || unitOptions(line.product)[0];
}

// Price of ONE chosen unit (the same calculation the server does)
function linePrice(line) {
  return Math.round(line.product.price * optionOf(line).factor);
}

function lineTotal(line) {
  return Math.round(linePrice(line) * (Number(line.quantity) || 0));
}

// How many BASE units this line takes from the stock
function lineBaseQuantity(line) {
  return (Number(line.quantity) || 0) * optionOf(line).factor;
}

function notEnoughStock(line) {
  return lineBaseQuantity(line) > line.product.stock;
}

function addProduct(product) {
  if (product.stock <= 0) {
    toast.error("Omborda qoldiq yo'q: " + product.name);
  }

  // The same product (in the base unit) is already in the cart: add 1 more
  const existing = cart.value.find(
    (line) => line.product._id === product._id && line.unitId === product.baseUnit._id
  );

  if (existing) {
    existing.quantity = Number(existing.quantity) + 1;
    return;
  }

  cart.value.push({ product, unitId: product.baseUnit._id, quantity: 1 });
}

function removeLine(index) {
  cart.value.splice(index, 1);
}

// ---------- Totals ----------
const discountType = ref('none');
const discountValue = ref(0);

const subtotal = computed(() => {
  return cart.value.reduce((sum, line) => sum + lineTotal(line), 0);
});

const discountAmount = computed(() => {
  const value = Number(discountValue.value) || 0;

  if (discountType.value === 'percent') {
    return Math.round((subtotal.value * Math.min(Math.max(value, 0), 100)) / 100);
  }

  if (discountType.value === 'amount') {
    return Math.min(Math.max(Math.round(value), 0), subtotal.value);
  }

  return 0;
});

const total = computed(() => subtotal.value - discountAmount.value);

// ---------- Customer and payments ----------
const customer = ref(null);

const payments = reactive({ cash: '', card: '', transfer: '', credit: '' });

const paidTotal = computed(() => {
  return ['cash', 'card', 'transfer', 'credit'].reduce((sum, method) => sum + (Math.round(Number(payments[method])) || 0), 0);
});

const remaining = computed(() => total.value - paidTotal.value);

function payAll(method) {
  payments.cash = '';
  payments.card = '';
  payments.transfer = '';
  payments.credit = '';
  payments[method] = total.value;
}

const creditWithoutCustomer = computed(() => {
  return (Number(payments.credit) || 0) > 0 && !customer.value;
});

const canSell = computed(() => {
  return (
    Boolean(auth.branchId) &&
    cart.value.length > 0 &&
    total.value > 0 &&
    remaining.value === 0 &&
    !creditWithoutCustomer.value
  );
});

// ---------- Sell ----------
const saving = ref(false);
const lastSale = ref(null);
const autoPrint = ref(false);

function resetSale() {
  cart.value = [];
  discountType.value = 'none';
  discountValue.value = 0;
  customer.value = null;
  payments.cash = '';
  payments.card = '';
  payments.transfer = '';
  payments.credit = '';
}

async function sell() {
  saving.value = true;

  try {
    const paymentList = ['cash', 'card', 'transfer', 'credit']
      .map((method) => ({ method, amount: Math.round(Number(payments[method])) || 0 }))
      .filter((payment) => payment.amount > 0);

    const data = await api.post('/sales', {
      branchId: auth.branchId,
      items: cart.value.map((line) => ({
        productId: line.product._id,
        unitId: line.unitId,
        quantity: Number(line.quantity),
      })),
      customerId: customer.value ? customer.value._id : undefined,
      discountType: discountType.value,
      discountValue: Number(discountValue.value) || 0,
      payments: paymentList,
    });

    lastSale.value = data.sale;
    resetSale();

    if (autoPrint.value) {
      printStore.printReceipt(data.sale);
    }
  } catch (error) {
    toast.error(error.message);
  } finally {
    saving.value = false;
  }
}

function finishAndContinue() {
  lastSale.value = null;

  if (pickerRef.value) {
    pickerRef.value.focusInput();
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <h1>Kassa</h1>
    </div>

    <p v-if="!auth.branchId" class="error-text" style="margin-bottom: 12px">
      Sotuv qilish uchun yuqoridan filialni tanlang.
    </p>

    <div class="pos">
      <!-- Left side: products and cart -->
      <div>
        <div class="panel" style="margin-bottom: 14px">
          <ProductPicker ref="pickerRef" camera autofocus @pick="addProduct" />
        </div>

        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Mahsulot</th>
                <th>Birlik</th>
                <th>Miqdor</th>
                <th class="num">Narxi</th>
                <th class="num">Summa</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(line, index) in cart" :key="index">
                <td>
                  {{ line.product.name }}
                  <div class="muted">{{ line.product.sku }}</div>
                  <div v-if="notEnoughStock(line)" class="error-text" style="margin: 2px 0 0">
                    Omborda yetarli emas (bor: {{ formatQty(line.product.stock) }} {{ line.product.baseUnit.name }})
                  </div>
                </td>
                <td style="width: 110px">
                  <select v-model="line.unitId">
                    <option v-for="option in unitOptions(line.product)" :key="option.id" :value="option.id">
                      {{ option.name }}
                    </option>
                  </select>
                </td>
                <td style="width: 110px">
                  <input
                    v-model="line.quantity"
                    type="number"
                    min="0"
                    :step="optionOf(line).allowDecimal ? 0.001 : 1"
                  />
                </td>
                <td class="num">{{ formatNumber(linePrice(line)) }}</td>
                <td class="num">{{ formatNumber(lineTotal(line)) }}</td>
                <td>
                  <button class="btn btn-small btn-danger" type="button" @click="removeLine(index)">X</button>
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="cart.length === 0" class="empty">
            Savat bo'sh. Mahsulotni skanerlang yoki yuqoridan qidiring.
          </div>
        </div>
      </div>

      <!-- Right side: totals and payment -->
      <aside class="ticket">
        <div class="ticket-total">{{ formatMoney(total) }}</div>

        <div class="ticket-row">
          <span>Mahsulotlar summasi</span>
          <span>{{ formatNumber(subtotal) }}</span>
        </div>
        <div v-if="discountAmount > 0" class="ticket-row">
          <span>Chegirma</span>
          <span>-{{ formatNumber(discountAmount) }}</span>
        </div>

        <div class="form-grid" style="grid-template-columns: 1fr 1fr; margin: 12px 0">
          <div class="field">
            <label>Chegirma turi</label>
            <select v-model="discountType">
              <option value="none">Yo'q</option>
              <option value="percent">Foiz (%)</option>
              <option value="amount">Summa (so'm)</option>
            </select>
          </div>
          <div class="field">
            <label>Qiymati</label>
            <input v-model="discountValue" type="number" min="0" :disabled="discountType === 'none'" />
          </div>
        </div>

        <div class="field" style="margin-bottom: 12px">
          <label class="label">Mijoz</label>
          <CustomerPicker v-model="customer" />
        </div>

        <div class="label" style="color: #a9b8c1; font-size: 0.88rem">To'lov</div>

        <div class="pay-grid">
          <div v-for="method in ['cash', 'card', 'transfer', 'credit']" :key="method" class="field">
            <label>{{ PAYMENT_LABELS[method] }}</label>
            <input v-model="payments[method]" type="number" min="0" step="1" />
          </div>
        </div>

        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px">
          <button class="btn btn-small" type="button" :disabled="total <= 0" @click="payAll('cash')">Hammasi naqd</button>
          <button class="btn btn-small" type="button" :disabled="total <= 0" @click="payAll('card')">Hammasi karta</button>
          <button class="btn btn-small" type="button" :disabled="total <= 0 || !customer" @click="payAll('credit')">
            Hammasi nasiya
          </button>
        </div>

        <div class="ticket-row">
          <span>To'langan</span>
          <span>{{ formatNumber(paidTotal) }}</span>
        </div>
        <div class="ticket-row" :class="{ 'warn-text': remaining !== 0 }">
          <span>Qoldi</span>
          <span>{{ formatNumber(remaining) }}</span>
        </div>

        <p v-if="creditWithoutCustomer" class="warn-text">Nasiya uchun mijozni tanlang.</p>

        <label class="check" style="margin: 10px 0">
          <input v-model="autoPrint" type="checkbox" />
          Sotuvdan keyin chekni chop etish
        </label>

        <button class="btn btn-primary btn-big" style="width: 100%" type="button" :disabled="!canSell || saving" @click="sell">
          Sotish
        </button>
      </aside>
    </div>

    <ModalDialog v-if="lastSale" title="Sotuv yakunlandi" @close="finishAndContinue">
      <p>
        Chek raqami: <strong>{{ lastSale.number }}</strong>
      </p>
      <p>
        Jami: <strong>{{ formatMoney(lastSale.total) }}</strong>
      </p>

      <template #footer>
        <button class="btn" type="button" @click="printStore.printReceipt(lastSale)">Chekni chop etish</button>
        <button class="btn btn-primary" type="button" @click="finishAndContinue">Yangi sotuv</button>
      </template>
    </ModalDialog>
  </div>
</template>
