<script setup>
import { onMounted, reactive, ref } from 'vue';

import { api } from '../lib/api';
import { useLookupsStore } from '../stores/lookups';
import { useToastStore } from '../stores/toast';
import { ROLE_LABELS } from '../lib/labels';
import ModalDialog from '../components/ModalDialog.vue';

const lookups = useLookupsStore();
const toast = useToastStore();

const users = ref([]);
const showForm = ref(false);
const editingId = ref(null);
const saving = ref(false);

const form = reactive({
  fullName: '',
  username: '',
  password: '',
  role: 'cashier',
  branch: '',
  isActive: true,
});

async function load() {
  try {
    const data = await api.get('/users');
    users.value = data.items;
  } catch (error) {
    toast.error(error.message);
  }
}

function openNew() {
  editingId.value = null;
  form.fullName = '';
  form.username = '';
  form.password = '';
  form.role = 'cashier';
  form.branch = '';
  form.isActive = true;
  showForm.value = true;
}

function openEdit(user) {
  editingId.value = user._id;
  form.fullName = user.fullName;
  form.username = user.username;
  form.password = '';
  form.role = user.role;
  form.branch = user.branch ? user.branch._id : '';
  form.isActive = user.isActive;
  showForm.value = true;
}

async function save() {
  saving.value = true;

  try {
    const body = {
      fullName: form.fullName,
      role: form.role,
      branch: form.role === 'admin' ? undefined : form.branch,
      isActive: form.isActive,
    };

    if (editingId.value) {
      if (form.password) {
        body.password = form.password;
      }

      await api.put('/users/' + editingId.value, body);
    } else {
      body.username = form.username;
      body.password = form.password;
      await api.post('/users', body);
    }

    showForm.value = false;
    toast.success('Saqlandi');
    await load();
  } catch (error) {
    toast.error(error.message);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="page-head">
      <h1>Foydalanuvchilar</h1>
      <button class="btn btn-primary" type="button" @click="openNew">Qo'shish</button>
    </div>

    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th>Ism</th>
            <th>Login</th>
            <th>Rol</th>
            <th>Filial</th>
            <th>Holati</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user._id">
            <td>{{ user.fullName }}</td>
            <td>{{ user.username }}</td>
            <td>{{ ROLE_LABELS[user.role] }}</td>
            <td>{{ user.branch ? user.branch.name : '-' }}</td>
            <td>
              <span class="badge" :class="user.isActive ? 'badge-ok' : 'badge-bad'">
                {{ user.isActive ? 'Faol' : 'Faol emas' }}
              </span>
            </td>
            <td class="right">
              <button class="btn btn-small" type="button" @click="openEdit(user)">Tahrirlash</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ModalDialog v-if="showForm" :title="editingId ? 'Foydalanuvchini tahrirlash' : 'Yangi foydalanuvchi'" @close="showForm = false">
      <div class="form-grid">
        <div class="field">
          <label>To'liq ismi</label>
          <input v-model="form.fullName" type="text" />
        </div>

        <div class="field">
          <label>Login</label>
          <input v-model="form.username" type="text" :disabled="Boolean(editingId)" autocomplete="off" />
        </div>

        <div class="field">
          <label>{{ editingId ? "Yangi parol (o'zgartirmasangiz bo'sh qoldiring)" : 'Parol (kamida 8 ta belgi)' }}</label>
          <input v-model="form.password" type="password" autocomplete="new-password" />
        </div>

        <div class="field">
          <label>Rol</label>
          <select v-model="form.role">
            <option value="cashier">Kassir</option>
            <option value="manager">Menejer</option>
            <option value="admin">Admin</option>
          </select>
        </div>

        <div v-if="form.role !== 'admin'" class="field">
          <label>Filial</label>
          <select v-model="form.branch">
            <option value="">Tanlang</option>
            <option v-for="branch in lookups.branches" :key="branch._id" :value="branch._id">
              {{ branch.name }}
            </option>
          </select>
        </div>

        <label v-if="editingId" class="check">
          <input v-model="form.isActive" type="checkbox" />
          Faol
        </label>
      </div>

      <template #footer>
        <button class="btn" type="button" @click="showForm = false">Bekor qilish</button>
        <button class="btn btn-primary" type="button" :disabled="saving" @click="save">Saqlash</button>
      </template>
    </ModalDialog>
  </div>
</template>
