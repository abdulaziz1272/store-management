// The logged-in user and the branch the user works in.

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { api } from '../lib/api';

const SELECTED_BRANCH_KEY = 'selectedBranchId';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const ready = ref(false); // true after we asked the server "who am I?"

  // Only the admin chooses a branch. '' means "all branches".
  const selectedBranchId = ref(localStorage.getItem(SELECTED_BRANCH_KEY) || '');

  const isLoggedIn = computed(() => user.value !== null);
  const role = computed(() => (user.value ? user.value.role : ''));
  const isAdmin = computed(() => role.value === 'admin');
  const isManager = computed(() => role.value === 'manager');
  const isCashier = computed(() => role.value === 'cashier');
  const canManage = computed(() => isAdmin.value || isManager.value);

  // The branch used for reading and writing data.
  // Manager and cashier: always their own branch. Admin: the selected one (can be '').
  const branchId = computed(() => {
    if (!user.value) {
      return '';
    }

    if (user.value.role === 'admin') {
      return selectedBranchId.value;
    }

    return user.value.branch ? user.value.branch._id : '';
  });

  function selectBranch(id) {
    selectedBranchId.value = id || '';
    localStorage.setItem(SELECTED_BRANCH_KEY, selectedBranchId.value);
  }

  async function fetchMe() {
    try {
      const data = await api.get('/auth/me');
      user.value = data.user;
    } catch (error) {
      user.value = null;
    } finally {
      ready.value = true;
    }
  }

  async function login(username, password) {
    const data = await api.post('/auth/login', { username, password });
    user.value = data.user;
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      user.value = null;
    }
  }

  return {
    user,
    ready,
    isLoggedIn,
    role,
    isAdmin,
    isManager,
    isCashier,
    canManage,
    branchId,
    selectedBranchId,
    selectBranch,
    fetchMe,
    login,
    logout,
  };
});
