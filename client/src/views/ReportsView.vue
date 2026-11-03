<script setup>
import { computed, onMounted, ref } from 'vue';

import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { useLookupsStore } from '../stores/lookups';
import { useToastStore } from '../stores/toast';
import { daysAgoString, formatMoney, formatNumber } from '../lib/format';

const auth = useAuthStore();
const lookups = useLookupsStore();
const toast = useToastStore();

// By default we show yesterday: this is the report the owner gets at midnight
const date = ref(daysAgoString(1));

// Admin chooses a branch (or "global"). Manager always sees his own branch.
const scope = ref(auth.branchId || '');

const report = ref(null);
const loading = ref(false);
const sending = ref(false);

const scopeValue = computed(() => (auth.isAdmin ? scope.value : auth.branchId));

onMounted(() => {
  // When the admin has not chosen anything yet, use the first branch
  if (auth.isAdmin && !scope.value && lookups.branches.length > 0) {
    scope.value = lookups.branches[0]._id;
  }
});

async function show() {
  if (!scopeValue.value) {
    toast.error('Filialni tanlang');
    return;
  }

  loading.value = true;

  try {
    const data = await api.get('/reports/daily', { date: date.value, branch: scopeValue.value });
    report.value = data.report;
  } catch (error) {
    toast.error(error.message);
  } finally {
    loading.value = false;
  }
}

async function downloadPdf() {
  try {
    await api.download(
      '/reports/daily/pdf',
      { date: date.value, branch: scopeValue.value },
      'hisobot_' + date.value + '.pdf'
    );
  } catch (error) {
    toast.error(error.message);
  }
}

async function sendToTelegram() {
  sending.value = true;

  try {
    await api.post('/reports/send?date=' + date.value + '&branch=' + scopeValue.value);
    toast.success('Telegramga yuborildi');
  } catch (error) {
    toast.error(error.message);
  } finally {
    sending.value = false;
  }
}

// The tables under the summary. "money: true" formats the number as money.
const sections = computed(() => {
  if (!report.value) {
    return [];
  }

  const r = report.value;

  const auditSection = {
    title: "Ma'lumotlardagi o'zgarishlar",
    rows: r.audit,
    columns: [
      { key: 'time', label: 'Vaqt' },
      { key: 'user', label: 'Xodim' },
      { key: 'action', label: 'Amal' },
      { key: 'entity', label: "Bo'lim" },
      { key: 'label', label: 'Nomi' },
      { key: 'changes', label: "O'zgarish" },
    ],
  };

  if (r.scope === 'global') {
    return [auditSection];
  }

  return [
    {
      title: 'Sotuvlar',
      rows: r.sales,
      columns: [
        { key: 'time', label: 'Vaqt' },
        { key: 'number', label: 'Chek' },
        { key: 'cashier', label: 'Kassir' },
        { key: 'customer', label: 'Mijoz' },
        { key: 'items', label: 'Mahsulotlar' },
        { key: 'discount', label: 'Chegirma', money: true },
        { key: 'total', label: 'Jami', money: true },
        { key: 'payments', label: "To'lov" },
      ],
    },
    {
      title: 'Qaytarishlar',
      rows: r.returns,
      columns: [
        { key: 'time', label: 'Vaqt' },
        { key: 'number', label: 'Raqam' },
        { key: 'saleNumber', label: 'Sotuv' },
        { key: 'user', label: 'Xodim' },
        { key: 'items', label: 'Mahsulotlar' },
        { key: 'refundAmount', label: 'Summa', money: true },
        { key: 'debtReduced', label: 'Qarzdan', money: true },
        { key: 'paidOut', label: 'Qaytarildi', money: true },
        { key: 'reason', label: 'Sabab' },
      ],
    },
    {
      title: 'Kirimlar',
      rows: r.purchases,
      columns: [
        { key: 'time', label: 'Vaqt' },
        { key: 'number', label: 'Raqam' },
        { key: 'supplier', label: 'Yetkazib beruvchi' },
        { key: 'user', label: 'Xodim' },
        { key: 'items', label: 'Mahsulotlar' },
        { key: 'totalCost', label: 'Summa', money: true },
      ],
    },
    {
      title: "Filiallararo ko'chirish",
      rows: r.transfers,
      columns: [
        { key: 'time', label: 'Vaqt' },
        { key: 'number', label: 'Raqam' },
        { key: 'direction', label: 'Turi' },
        { key: 'from', label: 'Qayerdan' },
        { key: 'to', label: 'Qayerga' },
        { key: 'user', label: 'Xodim' },
        { key: 'items', label: 'Mahsulotlar' },
      ],
    },
    {
      title: "Qarz to'lovlari",
      rows: r.debtPayments,
      columns: [
        { key: 'time', label: 'Vaqt' },
        { key: 'customer', label: 'Mijoz' },
        { key: 'amount', label: 'Summa', money: true },
        { key: 'method', label: 'Usul' },
        { key: 'user', label: 'Xodim' },
        { key: 'note', label: 'Izoh' },
      ],
    },
    {
      title: 'Qoldiq harakatlari',
      rows: r.movements,
      columns: [
        { key: 'time', label: 'Vaqt' },
        { key: 'type', label: 'Turi' },
        { key: 'product', label: 'Mahsulot' },
        { key: 'batchNumber', label: 'Partiya' },
        { key: 'quantity', label: 'Miqdor' },
        { key: 'refNumber', label: 'Hujjat' },
        { key: 'user', label: 'Xodim' },
        { key: 'note', label: 'Izoh' },
      ],
    },
    auditSection,
  ];
});
</script>

<template>
  <div>
    <div class="page-head">
      <h1>Kunlik hisobot</h1>
    </div>

    <div class="toolbar">
      <div class="field">
        <label>Sana</label>
        <input v-model="date" type="date" />
      </div>

      <div v-if="auth.isAdmin" class="field" style="min-width: 220px">
        <label>Filial</label>
        <select v-model="scope">
          <option v-for="branch in lookups.branches" :key="branch._id" :value="branch._id">{{ branch.name }}</option>
          <option value="global">Umumiy o'zgarishlar (admin)</option>
        </select>
      </div>

      <button class="btn btn-primary" type="button" :disabled="loading" @click="show">Ko'rsatish</button>
      <button class="btn" type="button" :disabled="!report" @click="downloadPdf">PDF yuklab olish</button>
      <button v-if="auth.isAdmin" class="btn" type="button" :disabled="!report || sending" @click="sendToTelegram">
        Telegramga yuborish
      </button>
    </div>

    <p class="muted">
      Kun vaqti O'zbekiston vaqti bo'yicha hisoblanadi (00:00 dan 24:00 gacha). Har kuni tungi 00:00 da
      oldingi kun hisoboti Telegramga avtomatik yuboriladi.
    </p>

    <div v-if="report">
      <h2 style="margin: 14px 0 10px">
        {{ report.scope === 'global' ? "Umumiy o'zgarishlar" : report.branch.name }}: {{ report.date }}
      </h2>

      <div v-if="report.scope === 'branch'" class="stats">
        <div class="stat">
          <div class="muted">Sotuvlar ({{ report.summary.salesCount }} ta)</div>
          <div class="value">{{ formatMoney(report.summary.salesTotal) }}</div>
        </div>
        <div class="stat">
          <div class="muted">Qaytarishlar ({{ report.summary.returnsCount }} ta)</div>
          <div class="value">{{ formatMoney(report.summary.refundTotal) }}</div>
        </div>
        <div class="stat">
          <div class="muted">Kirim ({{ report.summary.purchaseCount }} ta)</div>
          <div class="value">{{ formatMoney(report.summary.purchaseTotal) }}</div>
        </div>
        <div class="stat">
          <div class="muted">Nasiyaga berilgan</div>
          <div class="value">{{ formatMoney(report.summary.newDebt) }}</div>
        </div>
        <div class="stat">
          <div class="muted">Qarz to'lovlari</div>
          <div class="value">{{ formatMoney(report.summary.debtPaymentsTotal) }}</div>
        </div>
        <div class="stat">
          <div class="muted">Kassa: naqd / karta / o'tkazma</div>
          <div>
            {{ formatNumber(report.summary.netByMethod.cash) }} /
            {{ formatNumber(report.summary.netByMethod.card) }} /
            {{ formatNumber(report.summary.netByMethod.transfer) }}
          </div>
        </div>
      </div>

      <div v-for="section in sections" :key="section.title" style="margin-bottom: 18px">
        <h3 style="margin-bottom: 6px">{{ section.title }} ({{ section.rows.length }})</h3>

        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th v-for="column in section.columns" :key="column.key" :class="{ num: column.money }">
                  {{ column.label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in section.rows" :key="index">
                <td v-for="column in section.columns" :key="column.key" :class="{ num: column.money }" style="white-space: pre-line">
                  {{ column.money ? formatNumber(row[column.key]) : row[column.key] }}
                </td>
              </tr>
            </tbody>
          </table>

          <div v-if="section.rows.length === 0" class="empty">Ma'lumot yo'q</div>
        </div>
      </div>
    </div>
  </div>
</template>
