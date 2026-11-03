// Small messages in the corner of the screen.

import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useToastStore = defineStore('toast', () => {
  const messages = ref([]);
  let nextId = 1;

  function show(text, type) {
    const id = nextId;
    nextId += 1;

    messages.value.push({ id, text, type });

    setTimeout(() => {
      messages.value = messages.value.filter((item) => item.id !== id);
    }, 4500);
  }

  function success(text) {
    show(text, 'success');
  }

  function error(text) {
    show(text, 'error');
  }

  return { messages, success, error };
});
