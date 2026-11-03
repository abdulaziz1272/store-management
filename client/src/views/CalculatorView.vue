<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

const display = ref('0');
const storedValue = ref(null);
const pendingOperator = ref(null);
const waitingForOperand = ref(false);
const errorMessage = ref('');

const buttons = [
  { label: 'AC', action: 'clear', type: 'utility' },
  { label: '⌫', action: 'backspace', type: 'utility', aria: 'Oxirgi raqamni o\'chirish' },
  { label: '%', action: 'percent', type: 'utility' },
  { label: '÷', action: '/', type: 'operator' },
  { label: '7', action: '7' },
  { label: '8', action: '8' },
  { label: '9', action: '9' },
  { label: '×', action: '*', type: 'operator' },
  { label: '4', action: '4' },
  { label: '5', action: '5' },
  { label: '6', action: '6' },
  { label: '−', action: '-', type: 'operator' },
  { label: '1', action: '1' },
  { label: '2', action: '2' },
  { label: '3', action: '3' },
  { label: '+', action: '+', type: 'operator' },
  { label: '±', action: 'sign', type: 'utility' },
  { label: '0', action: '0', type: 'zero' },
  { label: '.', action: 'decimal' },
  { label: '=', action: 'equals', type: 'equals' },
];

function cleanNumber(value) {
  if (!Number.isFinite(value)) {
    return 'Xatolik';
  }

  const rounded = Number.parseFloat(value.toPrecision(12));
  return String(rounded);
}

function clearCalculator() {
  display.value = '0';
  storedValue.value = null;
  pendingOperator.value = null;
  waitingForOperand.value = false;
  errorMessage.value = '';
}

function inputDigit(digit) {
  errorMessage.value = '';

  if (display.value === 'Xatolik' || waitingForOperand.value) {
    display.value = digit;
    waitingForOperand.value = false;
    return;
  }

  display.value = display.value === '0' ? digit : display.value + digit;
}

function inputDecimal() {
  errorMessage.value = '';

  if (display.value === 'Xatolik' || waitingForOperand.value) {
    display.value = '0.';
    waitingForOperand.value = false;
    return;
  }

  if (!display.value.includes('.')) {
    display.value += '.';
  }
}

function calculate(left, right, operator) {
  if (operator === '+') return left + right;
  if (operator === '-') return left - right;
  if (operator === '*') return left * right;
  if (operator === '/') return right === 0 ? null : left / right;
  return right;
}

function showResult(value) {
  if (value === null || !Number.isFinite(value)) {
    display.value = 'Xatolik';
    errorMessage.value = 'Nolga bo‘lish mumkin emas';
    storedValue.value = null;
    pendingOperator.value = null;
    waitingForOperand.value = true;
    return;
  }

  display.value = cleanNumber(value);
}

function chooseOperator(operator) {
  if (display.value === 'Xatolik') {
    clearCalculator();
    return;
  }

  const currentValue = Number(display.value);

  if (pendingOperator.value && !waitingForOperand.value) {
    const result = calculate(storedValue.value, currentValue, pendingOperator.value);
    showResult(result);

    if (result === null) return;

    storedValue.value = result;
  } else {
    storedValue.value = currentValue;
  }

  pendingOperator.value = operator;
  waitingForOperand.value = true;
}

function calculateResult() {
  if (!pendingOperator.value || storedValue.value === null || display.value === 'Xatolik') {
    return;
  }

  const result = calculate(
    storedValue.value,
    Number(display.value),
    pendingOperator.value
  );

  showResult(result);
  storedValue.value = null;
  pendingOperator.value = null;
}

function applyPercent() {
  if (display.value === 'Xatolik') return;

  const value = Number(display.value) / 100;
  showResult(value);
}

function toggleSign() {
  if (display.value === 'Xatolik' || Number(display.value) === 0) return;

  display.value = display.value.startsWith('-')
    ? display.value.slice(1)
    : '-' + display.value;
}

function backspace() {
  if (display.value === 'Xatolik' || waitingForOperand.value) {
    display.value = '0';
    waitingForOperand.value = false;
    return;
  }

  display.value = display.value.length > 1
    ? display.value.slice(0, -1)
    : '0';

  if (display.value === '-') {
    display.value = '0';
  }
}

function handleAction(action) {
  if (/^\d$/.test(action)) {
    inputDigit(action);
    return;
  }

  if (action === 'decimal') inputDecimal();
  if (action === 'clear') clearCalculator();
  if (action === 'backspace') backspace();
  if (action === 'percent') applyPercent();
  if (action === 'sign') toggleSign();
  if (['+', '-', '*', '/'].includes(action)) chooseOperator(action);
  if (action === 'equals') calculateResult();
}

function handleKeyboard(event) {
  const target = event.target;
  const isTypingField = target instanceof HTMLElement && (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );

  // Do not hijack normal typing in search boxes or forms.
  if (isTypingField) return;

  const key = event.key;

  if (/^\d$/.test(key)) {
    event.preventDefault();
    inputDigit(key);
    return;
  }

  const actions = {
    '.': 'decimal',
    ',': 'decimal',
    '+': '+',
    '-': '-',
    '*': '*',
    '/': '/',
    '%': 'percent',
    Enter: 'equals',
    '=': 'equals',
    Backspace: 'backspace',
    Escape: 'clear',
  };

  if (actions[key]) {
    event.preventDefault();
    handleAction(actions[key]);
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyboard);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyboard);
});
</script>

<template>
  <section class="calculator-page">
    <div class="page-head">
      <div>
        <h1>Kalkulyator</h1>
        <p class="muted">Oddiy hisob-kitoblar uchun kalkulyator</p>
      </div>
      <span class="calculator-hint">Klaviatura orqali ham ishlaydi</span>
    </div>

    <div class="calculator-card">
      <div class="calculator-display" aria-live="polite" aria-label="Natija">
        <div class="calculator-expression">
          <template v-if="storedValue !== null">
            {{ cleanNumber(storedValue) }}
            {{ pendingOperator === '*' ? '×' : pendingOperator === '/' ? '÷' : pendingOperator === '-' ? '−' : pendingOperator }}
          </template>
          <span v-else> </span>
        </div>
        <div class="calculator-value">{{ display }}</div>
        <p v-if="errorMessage" class="calculator-error">{{ errorMessage }}</p>
      </div>

      <div class="calculator-grid">
        <button
          v-for="button in buttons"
          :key="button.action"
          type="button"
          class="calculator-button"
          :class="[
            button.type ? 'is-' + button.type : '',
            button.action === '0' ? 'is-zero' : '',
          ]"
          :aria-label="button.aria || button.label"
          @click="handleAction(button.action)"
        >
          {{ button.label }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.calculator-page {
  max-width: 560px;
  margin: 0 auto;
}

.calculator-hint {
  color: var(--muted);
  font-size: 0.88rem;
}

.calculator-card {
  width: 100%;
  max-width: 420px;
  margin: 22px auto;
  padding: 18px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(30, 42, 50, 0.08);
}

.calculator-display {
  min-height: 118px;
  padding: 14px 12px;
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: flex-end;
  overflow: hidden;
  background: #f1f4f5;
  border: 1px solid var(--line);
  border-radius: 6px;
}

.calculator-expression {
  min-height: 22px;
  color: var(--muted);
  font-size: 0.95rem;
}

.calculator-value {
  max-width: 100%;
  overflow-x: auto;
  color: var(--ink);
  font-size: clamp(2rem, 9vw, 2.7rem);
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.calculator-value::-webkit-scrollbar {
  display: none;
}

.calculator-error {
  margin: 5px 0 0;
  color: var(--danger);
  font-size: 0.82rem;
}

.calculator-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}

.calculator-button {
  min-height: 64px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #ffffff;
  color: var(--ink);
  font-size: 1.25rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}

.calculator-button:hover {
  background: #edf1f3;
}

.calculator-button:active {
  transform: scale(0.97);
}

.calculator-button:focus-visible {
  outline: 2px solid var(--steel);
  outline-offset: 2px;
}

.calculator-button.is-utility {
  background: #e8edef;
  color: var(--steel-dark);
}

.calculator-button.is-operator {
  background: #e6edf2;
  color: var(--steel-dark);
  font-size: 1.45rem;
}

.calculator-button.is-equals {
  background: var(--steel);
  border-color: var(--steel);
  color: #ffffff;
}

.calculator-button.is-equals:hover {
  background: var(--steel-dark);
}

.calculator-button.is-zero {
  grid-column: span 1;
}

@media (max-width: 480px) {
  .calculator-card {
    margin-top: 14px;
    padding: 12px;
  }

  .calculator-button {
    min-height: 58px;
  }

  .calculator-hint {
    display: none;
  }
}
</style>
