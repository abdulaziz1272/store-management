<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAuthStore } from './stores/auth';
import AppLayout from './components/AppLayout.vue';
import ToastHost from './components/ToastHost.vue';
import PrintSheet from './components/PrintSheet.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

// The api helper sends this event when the server says "you are not logged in"
function handleSessionExpired() {
  auth.user = null;
  router.push('/login');
}

onMounted(() => {
  window.addEventListener('session-expired', handleSessionExpired);
});

onBeforeUnmount(() => {
  window.removeEventListener('session-expired', handleSessionExpired);
});
</script>

<template>
  <div v-if="!auth.ready" class="splash">Yuklanmoqda...</div>

  <RouterView v-else-if="route.meta.public" />

  <AppLayout v-else-if="auth.isLoggedIn">
    <RouterView />
  </AppLayout>

  <ToastHost />
  <PrintSheet />
</template>
