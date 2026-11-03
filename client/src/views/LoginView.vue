<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();

const username = ref('');
const password = ref('');
const errorText = ref('');
const loading = ref(false);

async function submit() {
  errorText.value = '';
  loading.value = true;

  try {
    await auth.login(username.value, password.value);
    router.push('/');
  } catch (error) {
    errorText.value = error.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <form class="login-card" @submit.prevent="submit">
      <h1>Do'kon boshqaruvi</h1>
      <p class="muted">Tizimga kirish</p>

      <div class="field" style="margin-bottom: 12px">
        <label for="username">Foydalanuvchi nomi</label>
        <input id="username" v-model="username" type="text" autocomplete="username" required />
      </div>

      <div class="field" style="margin-bottom: 16px">
        <label for="password">Parol</label>
        <input id="password" v-model="password" type="password" autocomplete="current-password" required />
      </div>

      <button class="btn btn-primary btn-big" style="width: 100%" type="submit" :disabled="loading">
        Kirish
      </button>

      <p v-if="errorText" class="error-text">{{ errorText }}</p>
    </form>
  </div>
</template>
