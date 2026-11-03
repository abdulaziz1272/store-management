<script setup>
// The content that is printed. It lives directly inside <body> (Teleport),
// is hidden on screen and is the only thing visible when printing (see style.css).

import { usePrintStore } from '../stores/print';
import { formatDateTime, formatNumber, formatQty } from '../lib/format';
import { PAYMENT_LABELS } from '../lib/labels';

const printStore = usePrintStore();
</script>

<template>
  <Teleport to="body">
    <div class="print-root">
      <!-- Product stickers, one label = one page of 40mm x 30mm -->
      <template v-if="printStore.mode === 'labels'">
        <div v-for="(label, index) in printStore.labels" :key="index" class="label">
          <img :src="label.qr" alt="QR" />

          <div>
            <div class="label-price">
              {{ formatNumber(label.price) }}
              <small>so'm / {{ label.unit }}</small>
            </div>
            <div class="label-sku">{{ label.sku }}</div>
          </div>

          <div class="label-name">{{ label.name }}</div>
        </div>
      </template>

      <!-- Customer receipt -->
      <div v-if="printStore.mode === 'receipt' && printStore.sale" class="receipt">
        <h3>{{ printStore.sale.branch.name }}</h3>
        <div class="center">{{ printStore.sale.branch.address }}</div>
        <div class="center">{{ printStore.sale.branch.phone }}</div>
        <hr />

        <div>Chek: {{ printStore.sale.number }}</div>
        <div>Sana: {{ formatDateTime(printStore.sale.createdAt) }}</div>
        <div>Kassir: {{ printStore.sale.cashier ? printStore.sale.cashier.fullName : '' }}</div>
        <div v-if="printStore.sale.customer">Mijoz: {{ printStore.sale.customer.name }}</div>
        <hr />

        <table>
          <tbody>
            <template v-for="(item, index) in printStore.sale.items" :key="index">
              <tr>
                <td colspan="2">{{ item.name }}</td>
              </tr>
              <tr>
                <td>{{ formatQty(item.quantity) }} {{ item.unitName }} x {{ formatNumber(item.unitPrice) }}</td>
                <td class="r">{{ formatNumber(item.lineTotal) }}</td>
              </tr>
            </template>
          </tbody>
        </table>
        <hr />

        <table>
          <tbody>
            <tr>
              <td>Jami:</td>
              <td class="r">{{ formatNumber(printStore.sale.subtotal) }}</td>
            </tr>
            <tr v-if="printStore.sale.discountAmount > 0">
              <td>Chegirma:</td>
              <td class="r">-{{ formatNumber(printStore.sale.discountAmount) }}</td>
            </tr>
            <tr>
              <td><strong>TO'LOV:</strong></td>
              <td class="r">
                <strong>{{ formatNumber(printStore.sale.total) }} so'm</strong>
              </td>
            </tr>
            <tr v-for="(payment, index) in printStore.sale.payments" :key="index">
              <td>{{ PAYMENT_LABELS[payment.method] }}:</td>
              <td class="r">{{ formatNumber(payment.amount) }}</td>
            </tr>
          </tbody>
        </table>
        <hr />

        <div class="center">Xaridingiz uchun rahmat!</div>
      </div>
    </div>
  </Teleport>
</template>
