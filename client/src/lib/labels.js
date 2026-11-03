// Uzbek names for codes that come from the server.

export const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Menejer',
  cashier: 'Kassir',
};

export const PAYMENT_LABELS = {
  cash: 'Naqd',
  card: 'Karta',
  transfer: "O'tkazma",
  credit: 'Nasiya',
};

export const MOVEMENT_LABELS = {
  receive: 'Kirim',
  sale: 'Sotuv',
  return: 'Qaytarish',
  transfer_out: "Ko'chirish (chiqim)",
  transfer_in: "Ko'chirish (kirim)",
  adjustment: 'Tuzatish',
};

export const SALE_STATUS_LABELS = {
  completed: 'Yakunlangan',
  partially_returned: 'Qisman qaytarilgan',
  returned: 'Qaytarilgan',
};

export const ENTITY_LABELS = {
  Product: 'Mahsulot',
  Unit: "O'lchov birligi",
  Branch: 'Filial',
  User: 'Foydalanuvchi',
  Supplier: 'Yetkazib beruvchi',
  Customer: 'Mijoz',
};

export const ACTION_LABELS = {
  create: "Qo'shildi",
  update: "O'zgartirildi",
  import: 'Import',
};
