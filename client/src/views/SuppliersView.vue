<script setup>
import CrudPage from '../components/CrudPage.vue';

const columns = [
  { key: 'name', label: 'Nomi' },
  { key: 'phone', label: 'Telefon' },
  { key: 'address', label: 'Manzil' },
  { key: 'note', label: 'Izoh' },
];

const fields = [
  { key: 'name', label: 'Nomi', type: 'text' },
  { key: 'phone', label: 'Telefon', type: 'text' },
  { key: 'address', label: 'Manzil', type: 'text' },
  { key: 'note', label: 'Izoh', type: 'text' },
];
</script>

<template>
  <CrudPage
    title="Yetkazib beruvchilar"
    endpoint="/suppliers"
    :columns="columns"
    :fields="fields"
    lookup="suppliers"
  />
</template>
