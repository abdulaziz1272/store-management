// Small lists that many pages need: branches, units and suppliers.
// They are loaded once and kept here.

import { defineStore } from 'pinia';
import { ref } from 'vue';

import { api } from '../lib/api';

export const useLookupsStore = defineStore('lookups', () => {
  const branches = ref([]);
  const units = ref([]);
  const suppliers = ref([]);

  async function loadBranches() {
    const data = await api.get('/branches');
    branches.value = data.items;
  }

  async function loadUnits() {
    const data = await api.get('/units');
    units.value = data.items;
  }

  async function loadSuppliers() {
    const data = await api.get('/suppliers', { active: '1' });
    suppliers.value = data.items;
  }

  async function loadAll(canSeeSuppliers) {
    await Promise.all([loadBranches(), loadUnits()]);

    if (canSeeSuppliers) {
      await loadSuppliers();
    }
  }

  return { branches, units, suppliers, loadBranches, loadUnits, loadSuppliers, loadAll };
});
