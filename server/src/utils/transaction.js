// A transaction makes several database changes succeed or fail TOGETHER.
// Example: a sale must reduce the stock AND save the sale AND save the debt.
// If anything throws an error, everything is rolled back.

const mongoose = require('mongoose');

async function runInTransaction(work) {
  const session = await mongoose.startSession();

  try {
    let result;

    // withTransaction can run the function again if MongoDB asks for a retry,
    // so do not change variables outside of the function in a way that breaks on repeat.
    await session.withTransaction(async () => {
      result = await work(session);
    });

    return result;
  } finally {
    session.endSession();
  }
}

module.exports = { runInTransaction };
