// What is going to be printed: product stickers or a customer receipt.
// The component PrintSheet.vue shows it, and the browser prints it.

import { defineStore } from 'pinia';
import { nextTick, ref } from 'vue';
import QRCode from 'qrcode';

import { printWithPageSize } from '../lib/print';

export const usePrintStore = defineStore('print', () => {
  const mode = ref(''); // '', 'labels' or 'receipt'
  const labels = ref([]);
  const sale = ref(null);

  function reset() {
    mode.value = '';
    labels.value = [];
    sale.value = null;
  }

  // items: [{ sku, name, price, unit, copies }]
  async function printLabels(items) {
    const prepared = [];

    for (const item of items) {
      // The QR code contains only the SKU. The system finds everything else by it.
      const qr = await QRCode.toDataURL(item.sku, { margin: 0, width: 240, errorCorrectionLevel: 'M' });

      for (let copy = 0; copy < item.copies; copy += 1) {
        prepared.push({ sku: item.sku, name: item.name, price: item.price, unit: item.unit, qr });
      }
    }

    labels.value = prepared;
    mode.value = 'labels';

    await nextTick();

    // Sticker size 40mm x 30mm
    printWithPageSize('size: 40mm 30mm;');
  }

  async function printReceipt(saleData) {
    sale.value = saleData;
    mode.value = 'receipt';

    await nextTick();

    // The paper width (80mm roll) is chosen in the print dialog of the browser.
    printWithPageSize('');
  }

  // After printing is finished the sheet is cleared
  window.addEventListener('afterprint', () => {
    setTimeout(reset, 300);
  });

  return { mode, labels, sale, printLabels, printReceipt };
});
