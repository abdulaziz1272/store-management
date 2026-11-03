<script setup>
import { ref } from 'vue';

import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';
import { ROLE_LABELS } from '../lib/labels';

const auth = useAuthStore();
const toast = useToastStore();

const currentPassword = ref('');
const newPassword = ref('');
const saving = ref(false);

async function changePassword() {
  saving.value = true;

  try {
    await api.post('/auth/change-password', {
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    });

    toast.success("Parol o'zgartirildi");
    currentPassword.value = '';
    newPassword.value = '';
  } catch (error) {
    toast.error(error.message);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <h1>Profil</h1>
    </div>

    <div class="panel" style="max-width: 460px; margin-bottom: 16px">
      <p><strong>{{ auth.user.fullName }}</strong></p>
      <p class="muted">Login: {{ auth.user.username }}</p>
      <p class="muted">Rol: {{ ROLE_LABELS[auth.role] }}</p>
      <p v-if="auth.user.branch" class="muted">Filial: {{ auth.user.branch.name }}</p>
    </div>

    <form class="panel" style="max-width: 460px" @submit.prevent="changePassword">
      <h2 style="margin-bottom: 12px">Parolni o'zgartirish</h2>

      <div class="field" style="margin-bottom: 12px">
        <label>Joriy parol</label>
        <input v-model="currentPassword" type="password" autocomplete="current-password" required />
      </div>

      <div class="field" style="margin-bottom: 14px">
        <label>Yangi parol (kamida 8 ta belgi)</label>
        <input v-model="newPassword" type="password" autocomplete="new-password" minlength="8" required />
      </div>

      <button class="btn btn-primary" type="submit" :disabled="saving">Saqlash</button>
    </form>
  </div>
</template>
