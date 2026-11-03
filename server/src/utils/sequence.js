// Gives the next number of a counter: 1, 2, 3 ...
// Pass the same "session" as the rest of the transaction.

const Counter = require('../models/Counter');

async function nextSequence(counterName, session) {
  const counter = await Counter.findOneAndUpdate(
    { _id: counterName },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );

  return counter.seq;
}

// 7 -> "000007"
function padNumber(number, length = 6) {
  return String(number).padStart(length, '0');
}

module.exports = { nextSequence, padNumber };
