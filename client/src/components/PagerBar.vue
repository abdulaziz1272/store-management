<script setup>
import { computed } from 'vue';

const props = defineProps({
  page: { type: Number, required: true },
  limit: { type: Number, required: true },
  total: { type: Number, required: true },
});

const emit = defineEmits(['change']);

const pageCount = computed(() => Math.max(Math.ceil(props.total / props.limit), 1));
</script>

<template>
  <div class="pager">
    <span class="muted">Jami: {{ total }}</span>

    <button class="btn btn-small" type="button" :disabled="page <= 1" @click="emit('change', page - 1)">
      Oldingi
    </button>

    <span>{{ page }} / {{ pageCount }}</span>

    <button
      class="btn btn-small"
      type="button"
      :disabled="page >= pageCount"
      @click="emit('change', page + 1)"
    >
      Keyingi
    </button>
  </div>
</template>
