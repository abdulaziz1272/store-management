<script setup>
// A pop-up window. Use it like:
//   <ModalDialog title="Sarlavha" @close="open = false"> ...content... <template #footer> ...buttons... </template> </ModalDialog>

defineProps({
  title: { type: String, required: true },
  wide: { type: Boolean, default: false },
});

const emit = defineEmits(['close']);
</script>

<template>
  <div class="modal-backdrop" @mousedown.self="emit('close')" @keydown.esc="emit('close')">
    <div class="modal" :class="{ wide }" role="dialog" aria-modal="true">
      <div class="modal-head">
        <h2>{{ title }}</h2>
        <button class="btn btn-small" type="button" @click="emit('close')">Yopish</button>
      </div>

      <div class="modal-body">
        <slot />
      </div>

      <div v-if="$slots.footer" class="modal-foot">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>
