const fs = require('fs');
const path = require('path');

// Giả sử bạn đã có knex instance
const db = require('../database'); // đường dẫn đến file knex của bạn

async function syncRuns() {
    // Đọc file txt
    const lines = fs.readFileSync(path.join(__dirname, 'ok.txt'), 'utf8').split('\n').map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
        let [usernameLeft, usernameRight] = line.split(/\s+/); // tách theo khoảng trắng

        // Tìm user bên phải trong bảng users

        if (typeof usernameRight == 'undefined'){
            usernameRight = null
        }


        const user = await db('users').where('telegram_username', '=', usernameRight).first();
        const gameID = 9;
        // Insert vào bảng runs

        const checkRun = await db('runs').where("username", '=', usernameLeft)
            .where("game_id", '=', gameID)
            .first();

        if (!checkRun) {
            await db('runs').insert({
                user_id: user ? user.id : 1,
                game_id: gameID,
                username: usernameLeft,
                bank: null,
                created_at: new Date()
            });
        }



        console.log(`Inserted run: ${usernameLeft} -> ${usernameRight} (${user ? user.id : 'null'})`);
    }

    console.log('Hoàn thành insert vào runs.');
}

syncRuns().catch(console.error);
