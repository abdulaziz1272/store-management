<script setup>
// Reads a QR code with the phone (or computer) camera, using the library html5-qrcode.
// It tells the parent the text of the code:  @scan="onScan"

import { onBeforeUnmount, onMounted, ref } from 'vue';
import { Html5Qrcode } from 'html5-qrcode';

import ModalDialog from './ModalDialog.vue';

const emit = defineEmits(['scan', 'close']);

const errorText = ref('');
let scanner = null;
let finished = false;

onMounted(async () => {
  try {
    scanner = new Html5Qrcode('qr-reader');

    await scanner.start(
      { facingMode: 'environment' }, // the back camera of a phone
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (decodedText) => {
        // Report only the first code, then the parent closes this window
        if (!finished) {
          finished = true;
          emit('scan', decodedText);
        }
      },
      () => {
        // called for every frame without a code: ignore
      }
    );
  } catch (error) {
    errorText.value = "Kamerani ochib bo'lmadi. Brauzerga kameradan foydalanishga ruxsat bering.";
  }
});

onBeforeUnmount(async () => {
  if (scanner) {
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }

      scanner.clear();
    } catch (error) {
      // nothing to do
    }
  }
});
</script>

<template>
  <ModalDialog title="QR kodni skanerlash" @close="emit('close')">
    <div id="qr-reader" style="width: 100%"></div>
    <p v-if="errorText" class="error-text">{{ errorText }}</p>
  </ModalDialog>
</template>
