const axios = require('axios');
const db = require('./database');
require('dotenv').config();

async function checkBankTransactions() {
    try {
        const res = await axios.get(process.env.BANK_API);
        const transactions = res.data.transactions || [];

        for (const tx of transactions) {
            if (tx.type !== 'IN') continue;

            const description = tx.description.toLowerCase();
            const match = description.match(/gd(\d+)/); // mã giao dịch là id

            if (!match) continue;

            const transactionId = parseInt(match[1], 10);
            if (isNaN(transactionId)) continue;

            // Kiểm tra trong DB xem transaction này đã được xử lý chưa (status = 1)
            const transaction = await db('transactions')
                .where('id', '=', transactionId)
                .where('status', '=', 0)
                .first();

            if (!transaction) continue;

            // Cập nhật transaction và cộng tiền cho user
            await db('transactions')
                .where('id', '=', transactionId)
                .update({
                    amount: tx.amount,
                    status: 1,
                });

            await db('users')
                .where('id', '=', transaction.user_id)
                .increment('balance', tx.amount);


            console.log(`✅ Giao dịch #${transactionId} đã được xử lý`);
        }
    } catch (err) {
        console.error('❌ Lỗi khi kiểm tra giao dịch:', err.message);
    }
}

module.exports = checkBankTransactions;
