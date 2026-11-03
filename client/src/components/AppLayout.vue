<script setup>
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAuthStore } from '../stores/auth';
import { useLookupsStore } from '../stores/lookups';
import { ROLE_LABELS } from '../lib/labels';

const auth = useAuthStore();
const lookups = useLookupsStore();
const route = useRoute();
const router = useRouter();

const menuOpen = ref(false);
const calculatorOpen = ref(false);
const CalculatorView = defineAsyncComponent(() => import('../views/CalculatorView.vue'));

// Menu items. "roles" empty means every role can see the item.
const MENU = [
  { to: '/', label: 'Bosh sahifa', roles: [] },
  { to: '/checkout', label: 'Kassa', roles: [] },
  { to: '/sales', label: 'Sotuvlar', roles: [] },
  { group: 'Ombor', roles: [] },
  { to: '/products', label: 'Mahsulotlar', roles: [] },
  { to: '/stock', label: 'Qoldiq', roles: [] },
  { to: '/purchases', label: 'Kirim', roles: ['admin', 'manager'] },
  { to: '/transfers', label: "Ko'chirish", roles: ['admin', 'manager'] },
  { to: '/movements', label: 'Harakatlar', roles: ['admin', 'manager'] },
  { group: 'Hamkorlar', roles: [] },
  { to: '/customers', label: 'Mijozlar va qarzlar', roles: [] },
  { to: '/suppliers', label: 'Yetkazib beruvchilar', roles: ['admin', 'manager'] },
  { group: 'Nazorat', roles: ['admin', 'manager'] },
  { to: '/reports', label: 'Hisobotlar', roles: ['admin', 'manager'] },
  { to: '/audit', label: "O'zgarishlar tarixi", roles: ['admin', 'manager'] },
  { group: 'Sozlamalar', roles: ['admin'] },
  { to: '/branches', label: 'Filiallar', roles: ['admin'] },
  { to: '/units', label: "O'lchov birliklari", roles: ['admin'] },
  { to: '/users', label: 'Foydalanuvchilar', roles: ['admin'] },
];

const visibleMenu = computed(() => {
  return MENU.filter((item) => item.roles.length === 0 || item.roles.includes(auth.role));
});

// The branch name shown for manager and cashier
const ownBranchName = computed(() => {
  return auth.user && auth.user.branch ? auth.user.branch.name : '';
});

onMounted(async () => {
  try {
    await lookups.loadAll(auth.canManage);
  } catch (error) {
    // The pages show their own errors, a failed lookup must not block the layout
  }

  // The saved branch may not exist any more
  const exists = lookups.branches.some((branch) => branch._id === auth.selectedBranchId);

  if (auth.selectedBranchId && !exists) {
    auth.selectBranch('');
  }
});

// Close the mobile menu after moving to another page
watch(
  () => route.path,
  () => {
    menuOpen.value = false;
  }
);

function onBranchChange(event) {
  auth.selectBranch(event.target.value);
}

async function logout() {
  await auth.logout();
  router.push('/login');
}
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar" :class="{ open: menuOpen }">
      <div class="brand">
        Do'kon boshqaruvi
        <small>Qurilish mollari</small>
      </div>

      <nav class="nav">
        <template v-for="(item, index) in visibleMenu" :key="index">
          <div v-if="item.group" class="nav-group">{{ item.group }}</div>
          <RouterLink v-else :to="item.to">{{ item.label }}</RouterLink>
        </template>
      </nav>
    </aside>

    <div class="main">
      <header class="topbar">
        <button class="btn btn-small menu-button" type="button" @click="menuOpen = !menuOpen">Menyu</button>

        <div v-if="auth.isAdmin" class="field" style="min-width: 200px">
          <select :value="auth.selectedBranchId" aria-label="Filial" @change="onBranchChange">
            <option value="">Barcha filiallar</option>
            <option v-for="branch in lookups.branches" :key="branch._id" :value="branch._id">
              {{ branch.name }}
            </option>
          </select>
        </div>
        <strong v-else>{{ ownBranchName }}</strong>

        <div class="spacer"></div>

        <RouterLink to="/profile">{{ auth.user.fullName }} ({{ ROLE_LABELS[auth.role] }})</RouterLink>
        <button class="btn btn-small" type="button" @click="logout">Chiqish</button>
      </header>

      <main class="page">
        <slot />
      </main>
    </div>

    <button
      class="calculator-fab"
      type="button"
      aria-label="Kalkulyatorni ochish"
      title="Kalkulyator"
      @click="calculatorOpen = true"
    >
      <span aria-hidden="true">＋</span>
      <span>Kalkulyator</span>
    </button>

    <div
      v-if="calculatorOpen"
      class="calculator-overlay"
      @click.self="calculatorOpen = false"
      @keydown.esc="calculatorOpen = false"
    >
      <section class="calculator-modal" role="dialog" aria-modal="true" aria-label="Kalkulyator">
        <button
          class="calculator-close"
          type="button"
          aria-label="Yopish"
          @click="calculatorOpen = false"
        >
          ×
        </button>
        <CalculatorView />
      </section>
    </div>
  </div>
</template>

<style scoped>
.calculator-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 40;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 17px;
  border: 0;
  border-radius: 999px;
  background: var(--steel);
  color: #ffffff;
  font: inherit;
  font-weight: 600;
  box-shadow: 0 5px 18px rgba(30, 42, 50, 0.25);
  cursor: pointer;
}

.calculator-fab:hover {
  background: var(--steel-dark);
}

.calculator-fab > span:first-child {
  font-size: 1.35rem;
  line-height: 1;
}

.calculator-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  overflow-y: auto;
  background: rgba(20, 30, 38, 0.55);
}

.calculator-modal {
  position: relative;
  width: 100%;
  max-width: 500px;
  max-height: calc(100vh - 36px);
  overflow-y: auto;
  padding: 22px 16px 10px;
  border-radius: 10px;
  background: var(--surface);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.25);
}

.calculator-close {
  position: absolute;
  top: 8px;
  right: 10px;
  z-index: 2;
  width: 34px;
  height: 34px;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--surface);
  color: var(--ink);
  font-size: 1.4rem;
  line-height: 1;
  cursor: pointer;
}

.calculator-modal :deep(.calculator-page) {
  max-width: none;
}

.calculator-modal :deep(.calculator-card) {
  margin-top: 12px;
  margin-bottom: 10px;
  box-shadow: none;
}

@media (max-width: 600px) {
  .calculator-fab {
    right: 14px;
    bottom: 14px;
    padding: 11px 14px;
  }

  .calculator-fab > span:last-child {
    display: none;
  }

  .calculator-modal {
    padding: 22px 10px 8px;
  }
}
</style>
