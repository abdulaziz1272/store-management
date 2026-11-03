<script setup>
import CrudPage from '../components/CrudPage.vue';

const columns = [
  { key: 'name', label: 'Nomi' },
  { key: 'allowDecimal', label: 'Kasr son mumkin', bool: true },
];

const fields = [
  { key: 'name', label: 'Nomi (masalan kg)', type: 'text' },
  { key: 'allowDecimal', label: 'Kasr son mumkin (2.5 kg kabi)', type: 'checkbox' },
];
</script>

<template>
  <CrudPage
    title="O'lchov birliklari"
    endpoint="/units"
    :columns="columns"
    :fields="fields"
    :has-active="false"
    lookup="units"
  />
</template>
