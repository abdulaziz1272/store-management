<script setup>
import { useToastStore } from '../stores/toast';

const toast = useToastStore();
</script>

<template>
  <div class="toasts" aria-live="polite">
    <div v-for="message in toast.messages" :key="message.id" class="toast" :class="message.type">
      {{ message.text }}
    </div>
  </div>
</template>
