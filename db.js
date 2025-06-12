const db = require('./database.js');

(async () => {
  try {
    let createTransaction = await db('transactions').insert({
      user_id: 1,
      amount: 0,
      status: 0,
      created_at: new Date(),
    });
    console.log('Transaction created with ID:', createTransaction);
  } catch (err) {
    console.error('Lỗi kết nối DB:', err.message);
  }
})();
