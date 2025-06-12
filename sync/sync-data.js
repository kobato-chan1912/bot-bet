const fs = require('fs');
const path = require('path');

// Đọc file json
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));

// Giả định bạn đã có knex instance
const db = require("../database.js")

async function syncData() {
    for (const [username, balance] of Object.entries(data)) {
        // Insert user
        const user_id = await db('users').insert({
            telegram_username: username,
            balance: balance
        }); // Chú ý: với MySQL thì có thể chỉ cần `.insert().then` lấy insertId, với PostgreSQL thì dùng returning.

        // Insert transaction
        await db('transactions').insert({
            user_id: user_id,
            amount: balance,
            status: 1,
            created_at: new Date(),
            note: 'Đồng bộ dữ liệu'
        });

        console.log(`Đã insert user ${username} với balance ${balance}`);
    }
    console.log('Hoàn thành đồng bộ.');
}

syncData().catch(console.error);
