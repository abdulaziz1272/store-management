<script setup>
import CrudPage from '../components/CrudPage.vue';

const columns = [
  { key: 'name', label: 'Nomi' },
  { key: 'code', label: 'Kodi' },
  { key: 'address', label: 'Manzil' },
  { key: 'phone', label: 'Telefon' },
  { key: 'isWarehouse', label: 'Omborxona', bool: true },
];

const fields = [
  { key: 'name', label: 'Nomi', type: 'text' },
  { key: 'code', label: 'Kodi (masalan MAIN)', type: 'text' },
  { key: 'address', label: 'Manzil', type: 'text' },
  { key: 'phone', label: 'Telefon', type: 'text' },
  { key: 'isWarehouse', label: "Omborxona (sotuv qilinmaydi)", type: 'checkbox' },
];
</script>

<template>
  <CrudPage title="Filiallar" endpoint="/branches" :columns="columns" :fields="fields" lookup="branches" />
</template>
