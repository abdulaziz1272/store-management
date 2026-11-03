<script setup>
import { onMounted, ref, watch } from 'vue';

import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';
import { formatDate, formatMoney, formatQty } from '../lib/format';

const auth = useAuthStore();
const toast = useToastStore();

const data = ref(null);

async function load() {
  try {
    data.value = await api.get('/dashboard', { branch: auth.branchId });
  } catch (error) {
    toast.error(error.message);
  }
}

onMounted(load);
watch(() => auth.branchId, load);

function isExpired(value) {
  return new Date(value) < new Date();
}
</script>

<template>
  <div>
    <div class="page-head">
      <h1>Bosh sahifa</h1>
      <RouterLink class="btn btn-primary" to="/checkout">Kassaga o'tish</RouterLink>
    </div>

    <div v-if="data">
      <div class="stats">
        <div class="stat">
          <div class="muted">Bugungi sotuvlar</div>
          <div class="value">{{ data.todaySalesCount }}</div>
        </div>
        <div class="stat">
          <div class="muted">Bugungi savdo summasi</div>
          <div class="value">{{ formatMoney(data.todaySalesTotal) }}</div>
        </div>
        <div v-if="data.totalDebt !== null" class="stat">
          <div class="muted">Mijozlarning umumiy qarzi</div>
          <div class="value">{{ formatMoney(data.totalDebt) }}</div>
        </div>
      </div>

      <div v-if="!auth.isCashier" class="two-columns">
        <div class="panel">
          <h2 style="margin-bottom: 10px">Qoldiq kam mahsulotlar</h2>

          <div v-if="data.lowStock.length === 0" class="muted">Hammasi yetarli</div>

          <table v-else class="data">
            <thead>
              <tr>
                <th>Mahsulot</th>
                <th class="num">Qoldiq</th>
                <th class="num">Minimum</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in data.lowStock" :key="item.sku">
                <td>{{ item.name }}</td>
                <td class="num">{{ formatQty(item.quantity) }} {{ item.unit }}</td>
                <td class="num">{{ formatQty(item.minStock) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="panel">
          <h2 style="margin-bottom: 10px">Yaroqlilik muddati yaqin (30 kun)</h2>

          <div v-if="data.expiringSoon.length === 0" class="muted">Muddati yaqin tovar yo'q</div>

          <table v-else class="data">
            <thead>
              <tr>
                <th>Mahsulot</th>
                <th>Filial</th>
                <th class="num">Miqdor</th>
                <th>Muddati</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in data.expiringSoon" :key="index">
                <td>{{ item.product }}</td>
                <td>{{ item.branch }}</td>
                <td class="num">{{ formatQty(item.quantity) }}</td>
                <td>
                  <span class="badge" :class="isExpired(item.expiryDate) ? 'badge-bad' : 'badge-warn'">
                    {{ formatDate(item.expiryDate) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
