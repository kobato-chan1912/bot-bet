const TelegramBot = require('node-telegram-bot-api');
const db = require("./database.js")
const usersState = {};
const checkBankTransactions = require('./cron.js');

const homeText = `🎁 HỖ TRỢ NHẬP CODE – HOÀN 100% CHO KHÁCH MỚI 🎁
Áp dụng cho nhà cái:
F8BET | SHBET | 8KBET | MB66 | NEW88 | JUN1 | JUN2 | J88

🧧 CODE 8KBET ~ J88 (RANDOM: 18 / 28 / 38)
💸 Chỉ 5K / 1 lần nhập
🎁 CODE giá trị từ: 18K – 85K
✅ Giá rẻ nhất thị trường
✅ Uy tín tuyệt đối – Không lừa đảo
🔈 ƯU ĐÃI ĐẶC BIỆT
♻️ Auto tự động hoàn cho tài khoản bị lạm dụng .  
📩 Liên hệ hỗ trợ: [@BeNi2kk]
🛒 Mua code tại BOT: [@HUNTER_CODE_DEN_BOT]
🔈THEO DÕI KÊNH https://t.me/+8FWzZ93BMQM2YTE1
`;



const homeKeyboard = [
    [{ text: '🎯 Chọn game', callback_data: 'choose_game' }],
    [{ text: 'ℹ️ Thông tin', callback_data: 'info' }],
    [{ text: '📞 Chăm sóc khách hàng', callback_data: 'support' }]
];


async function sendMessage(chatId, text, options = {}) {
    try {
        return bot.sendMessage(chatId, text, options)
    } catch (error) {

        return;

    }
}

async function sendOrEdit(chatId, text, keyboard, messageId = null) {
    try {
        const options = {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboard }
        };

        if (messageId) {
            try {
                return await bot.editMessageText(text, {
                    chat_id: chatId,
                    message_id: messageId,
                    ...options
                });
            } catch (error) {
                return;
            }
        } else {
            return sendMessage(chatId, text, options);
        }
    } catch (error) {
        // Xử lý các lỗi khác nếu cần
    }
}

function backKeyboard(route) {
    return {
        inline_keyboard: [[{ text: '🔙 Quay lại', callback_data: route }]]
    };
}

async function ensureUser(telegramId, username) {
    const exists = await db('users').where('telegram_username', '=', username).first();
    if (!exists) {
        await db('users').insert({
            telegram_user_id: telegramId,
            telegram_username: username,
            balance: 0
        });
    }

    if (exists && exists.telegram_user_id == null) {
        await db('users').where("telegram_username", "=", username).update({
            telegram_user_id: telegramId,
        });
    }
}



const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    await ensureUser(chatId, msg.from.username);
    const text = homeText;
    const keyboard = homeKeyboard;

    sendMessage(chatId, "Welcome To Hunter Bot!", {
        reply_markup: {
            remove_keyboard: true
        }
    })




    sendOrEdit(chatId, text, keyboard);


});


bot.on('callback_query', async (query) => {



    try {
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        const data = query.data;
        usersState[chatId] = null;
        const user = await db('users').where('telegram_user_id', '=', chatId).first();

        if (user.status === 0)
            return sendMessage(chatId, "❗ Tài khoản của bạn đã bị cấm với lý do: " + (user.ban_reason || "Không rõ"));


        //// Page 2 //// 


        if (data === 'choose_game') {

            const keyboard = [];

            let games = await db('games').where("enable", "=", 1).get();
            for (let i = 0; i < games.length; i += 2) {
                const row = [];
                row.push({ text: "️⚽ " + games[i].name, callback_data: `selectgame_${games[i].id}` });
                if (games[i + 1]) {
                    row.push({ text: "️⚽ " + games[i + 1].name, callback_data: `selectgame_${games[i + 1].id}` });
                }
                keyboard.push(row);
            }

            keyboard.push([{ text: '🔙 Quay lại', callback_data: 'back_home' }]);

            const text = '🎮 Vui lòng chọn một game bên dưới';
            sendOrEdit(chatId, text, keyboard, messageId);

        }


        if (data === 'info') {
            const text = '💡 Vui lòng chọn một tùy chọn bên dưới...';
            const keyboard = [
                [{ text: '💰 Xem số dư', callback_data: 'balance' }],
                [{ text: '🏦 Nạp tiền', callback_data: 'deposit' }],
                [{ text: '📜 Lịch sử giao dịch', callback_data: 'history' }],
                [{ text: '🔙 Quay lại', callback_data: 'back_home' }]
            ];
            return sendOrEdit(chatId, text, keyboard, messageId);
        }


        /// Page 3 ///

        if (data === 'balance') {
            const balance = user?.balance || 0;
            return bot.editMessageText(`💰 Số dư hiện tại của bạn là: ${balance.toLocaleString()}đ`, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: backKeyboard("info")
            });
        }

        if (data === 'deposit') {
            // Tạo transaction

            let code = null;

            if (user) {
                let createTransaction = await db('transactions').insert({
                    user_id: user.id,
                    amount: 0,
                    status: 0,
                    created_at: new Date(),
                    note: `Nạp tiền`
                });
                code = createTransaction
            }




            const qrLink = `https://img.vietqr.io/image/acb-${process.env.BANK}-compact.jpg?addInfo=naptienbot gd${code}`;
            const text = `📥 Vui lòng quét mã QR bên trên để nạp tiền\n\n💳 Nội dung chuyển khoản: naptienbot gd${code}`;

            await bot.sendPhoto(chatId, qrLink);

            const sent = await sendMessage(chatId, text, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Quay lại', callback_data: 'info' }]
                    ]
                }
            });


        }

        if (data === 'history') {
            const list = await db('transactions')
                .where('user_id', '=', user.id)
                .where('status', '=', 1)
                .orderBy('created_at', 'desc')
                .limit(10)
                .get();


            let text = `📜 10 giao dịch gần đây:\n\n`;
            if (list.length === 0) text += `Không có giao dịch nào.`;
            else {
                for (const tx of list) {
                    text += `💸 ${tx.amount.toLocaleString()}đ - ${new Date(tx.created_at).toLocaleString()} (${tx.note})\n`;
                }
            }

            // lịch sử chạy 
            const runs = await db('runs')
                .where('user_id', '=', user.id)
                .orderBy('created_at', 'desc')
                .limit(10)
                .get();
            text += `\n📊 Lịch sử chạy (10 acc gần nhất):\n\n`
            if (runs.length === 0) text += `Không có lịch sử chạy nào.`;
            else {
                for (const run of runs) {
                    const game = await db('games').where('id', '=', run.game_id).first();
                    text += `🎮 ${game.name} | ${run.username} | ${run.status ?? 'Đang chạy'}\n`;
                }
            }

            return bot.editMessageText(text, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: backKeyboard("info")
            });
        }


        if (data.startsWith('selectgame_')) {
            let gameId = data.split('_')[1];
            let game = await db('games').where('id', '=', gameId).first();
            sendOrEdit(chatId, `✅ Bạn đã chọn: ${game.name}

🛍 Bạn muốn làm gì tiếp theo?
🔹 Mua hàng: Chọn sản phẩm bạn muốn.
🔸 Trả hàng - Hoàn tiền: Yêu cầu hỗ trợ.

⏳ Vui lòng chọn một tùy chọn bên dưới...`,

                [
                    [{ text: '📥 Thêm tài khoản', callback_data: `addaccount_${gameId}` }],
                    [{ text: '♻️ Hoàn tiền', callback_data: `refund_${gameId}` }],
                    [{ text: '🔙 Quay lại', callback_data: 'choose_game' }],

                ], messageId);
        }

        if (data.startsWith('addaccount_')) {
            let gameId = data.split('_')[1];
            let game = await db('games').where('id', '=', gameId).first();
            sendOrEdit(chatId, `✅ Bạn đang thêm tài khoản: ${game.name}

🛍 Lưu ý
🔹 Mỗi tài khoản ${game.name} trị giá ${game.price}đ. Xuống dòng để thêm nhiều tài khoản.
🔸 Với J88 thì bạn thêm 4 số cuối vào sau tài khoản

⏳ Vui lòng nhập tài khoản bên dưới bạn nhé!`,

                [
                    [{ text: '🔙 Quay lại', callback_data: 'selectgame_' + gameId }],

                ], messageId);
            usersState[chatId] = "addaccount_" + gameId;
            return;
        }

        if (data.startsWith('refund_')) {
            let gameId = data.split('_')[1];
            let game = await db('games').where('id', '=', gameId).first();
            sendOrEdit(chatId, `✅ Bạn đang hoàn tiền tài khoản: ${game.name}

🛍 Lưu ý
🔹 Mỗi tài khoản là một hàng. Xuống dòng để thêm nhiều tài khoản.

⏳ Vui lòng nhập tài khoản bên dưới bạn nhé...`,

                [
                    [{ text: '🔙 Quay lại', callback_data: 'selectgame_' + gameId }],

                ], messageId);
            usersState[chatId] = "refund_" + gameId;
            return;
        }


        //// *** BACK ROUTES **** ///// 

        if (data === 'back_home') {

            const text = homeText;
            const keyboard = homeKeyboard;
            sendOrEdit(chatId, text, keyboard, messageId);
        }







        bot.answerCallbackQuery(query.id);
    } catch { }



});


bot.on('message', async (msg) => {

    try {
        const chatId = msg.chat.id;
        const user = await db('users').where('telegram_user_id', '=', chatId).first();
        const text = msg.text;
        if (text.startsWith('/')) return; // Ignore commands
        let state = usersState[chatId];

        if (state && state.startsWith('addaccount_')) {
            let gameId = state.split('_')[1];
            let game = await db('games').where('id', '=', gameId).first();
            if (!game || !user) return;

            // Parse accounts
            let lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            let accounts = [];
            if (game.is_need_bank) {
                // Each line: username bank
                for (let line of lines) {
                    let [username, bank] = line.split(/\s+/);
                    if (username && bank) {
                        accounts.push({ username, bank });
                    }
                }
            } else {
                // Each line: username only
                for (let line of lines) {
                    accounts.push({ username: line });
                }
            }

            // format accounts, remove duplicates
            accounts = accounts.map(acc => ({
                username: acc.username,
                bank: acc.bank ? acc.bank : null
            })).filter((acc, index, self) =>
                index === self.findIndex(a => a.username === acc.username && a.bank === acc.bank)
            );

            if (accounts.length === 0) {
                await sendMessage(chatId, '❗ Định dạng tài khoản không hợp lệ. Vui lòng thử lại.');
                return;
            }

            // Check balance
            let totalPrice = accounts.length * game.price;
            if (user.balance < totalPrice) {
                await sendMessage(chatId, `❗ Số dư không đủ. Bạn cần ${totalPrice.toLocaleString()}đ để thêm ${accounts.length} tài khoản.`);
                return;
            }

            // Add to runs and deduct balance
            for (let acc of accounts) {

                await db('transactions').insert({
                    user_id: user.id,
                    amount: -game.price,
                    status: 1,
                    created_at: new Date(),
                    note: `Mua code ${acc.username} cho ${game.name}`
                });


                await db('runs').insert({
                    user_id: user.id,
                    game_id: game.id,
                    username: acc.username,
                    bank: acc.bank || null,
                    created_at: new Date()
                });
            }
            await db('users').where('id', '=', user.id).update({
                balance: user.balance - totalPrice
            });

            await sendMessage(chatId, `✅ Đã thêm ${accounts.length} tài khoản cho game "${game.name}". Số dư còn lại: ${(user.balance - totalPrice).toLocaleString()}đ`);
            usersState[chatId] = null;
        }


        if (state && state.startsWith('refund_')) {
            let gameId = state.split('_')[1];
            let game = await db('games').where('id', '=', gameId).first();
            if (!game || !user) return;

            // Parse accounts
            let lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            let refunded = 0;
            let notFound = [];
            for (let username of lines) {
                // Tìm run chưa done
                let run = await db('runs')
                    .where('user_id', '=', user.id)
                    .where('game_id', '=', game.id)
                    .where('username', '=', username)
                    .whereRaw("COALESCE(status, '') NOT IN (?, ?)", ['done', 'refunded'])
                    .first();


                if (run) {
                    // Refund 80% giá game
                    let refundAmount = game.price * 0.8;
                    await db('users').where('id', '=', user.id).increment('balance', refundAmount);
                    await db('transactions').insert({
                        user_id: user.id,
                        amount: refundAmount,
                        status: 1,
                        created_at: new Date(),
                        note: `Refund tài khoản ${username} game ${game.name}`
                    });
                    // Đánh dấu run đã refund (nếu muốn)
                    await db('runs').where('id', '=', run.id).update({ status: 'refunded' });
                    refunded++;
                } else {
                    notFound.push(username);
                }
            }

            let msg = `✅ Đã refund ${refunded} tài khoản (${(refunded * Math.floor(game.price * 0.7)).toLocaleString()}đ) cho game ${game.name}.`;
            if (notFound.length) {
                msg += `\n\n❗ Không tìm thấy hoặc đã done/refunded: ${notFound.join(', ')}`;
            }
            await sendMessage(chatId, msg);
            usersState[chatId] = null;
        }
    } catch (error) { }


});




bot.onText(/^\/(\w+)(.*)/, async (msg, match) => {


    try {
        const chatId = msg.chat.id;
        const username = msg.from.username;
        if (!username) return sendMessage(chatId, "❗ Bạn cần đặt username Telegram để sử dụng lệnh.");
        const user = await db('users').where('telegram_username', '=', username).first();
        if (!user) return sendMessage(chatId, "❗ Không tìm thấy thông tin tài khoản.");
        if (user.status === 0) return sendMessage(chatId, "❗ Tài khoản của bạn đã bị cấm với lý do: " + (user.ban_reason || "Không rõ"));
        const role = user.role;
        const command = match[1];
        const args = match[2].trim();

        // Helper to get user by @username
        async function getUserByMention(mention) {
            if (!mention.startsWith('@')) return null;
            return await db('users').where('telegram_username', '=', mention.slice(1)).first();
        }

        // Role check
        const adminCmds = [
            'congtien', 'trutien', 'resetbalance', 'addacc', 'deleteacc', 'viewlogs', 'refund',
            'ban', 'unban', 'setadmin', 'unsetadmin', 'broadcast', 'viewbalance', 'stats', 'setprice'
        ];
        const modCmds = [
            'congtien', 'refund', 'addacc', 'deleteacc', 'viewlogs', 'viewbalance', 'broadcast', 'ban'
        ];
        if (role !== 'admin' && (adminCmds.includes(command) && role !== 'mod' && modCmds.includes(command))) {
            return sendMessage(chatId, "❗ Bạn không có quyền sử dụng lệnh này.");
        }
        if (role !== 'admin' && role !== 'mod') {
            return; // Ignore all commands for non-admin/mod
        }

        // Command handlers
        if (command === 'congtien') {
            const [mention, amountStr] = args.split(/\s+/);
            const target = await getUserByMention(mention);
            const amount = parseInt(amountStr);
            if (!target || isNaN(amount)) return sendMessage(chatId, "❗ Sai cú pháp hoặc không tìm thấy user.");
            await db('users').where('id', '=', target.id).increment('balance', amount);
            await db('transactions').insert({
                user_id: target.id,
                amount: amount,
                status: 1,
                created_at: new Date(),
                note: `Admin cộng tiền`
            });
            return sendMessage(chatId, `✅ Đã cộng ${amount.toLocaleString()}đ cho @${target.telegram_username}`);
        }

        if (command === 'trutien') {
            const [mention, amountStr] = args.split(/\s+/);
            const target = await getUserByMention(mention);
            const amount = parseInt(amountStr);
            if (!target || isNaN(amount)) return sendMessage(chatId, "❗ Sai cú pháp hoặc không tìm thấy user.");
            await db('users').where('id', '=', target.id).decrement('balance', amount);
            await db('transactions').insert({
                user_id: target.id,
                amount: -amount,
                status: 1,
                created_at: new Date(),
                note: `Admin trừ tiền`
            });
            return sendMessage(chatId, `✅ Đã trừ ${amount.toLocaleString()}đ của @${target.telegram_username}`);
        }

        if (command === 'resetbalance') {
            const mention = args.trim();
            const target = await getUserByMention(mention);
            if (!target) return sendMessage(chatId, "❗ Không tìm thấy user.");
            await db('users').where('id', '=', target.id).update({ balance: 0 });
            await db('transactions').insert({
                user_id: target.id,
                amount: -target.balance,
                status: 1,
                created_at: new Date(),
                note: `Admin reset số dư`
            });
            return sendMessage(chatId, `✅ Đã reset số dư về 0 cho @${target.telegram_username}`);
        }

        if (command === 'addacc') {
            const [gameId, ...rest] = args.split(/\s+/);
            const accountsStr = rest.join(' ');
            const accountsArr = accountsStr.split(',').map(a => a.trim()).filter(a => a.length > 0);
            const game = await db('games').where('id', '=', gameId).first();
            if (!game) return sendMessage(chatId, "❗ Không tìm thấy game.");

            if (game.is_need_bank) {
                // Mỗi acc: username bank (cách nhau bởi dấu cách)
                for (const acc of accountsArr) {
                    const [username, bank] = acc.split(/\s+/);
                    if (!username || !bank) continue;
                    await db('runs').insert({
                        user_id: user.id,
                        game_id: game.id,
                        username,
                        bank,
                        created_at: new Date()
                    });
                }
            } else {
                // Chỉ username
                for (const acc of accountsArr) {


                    await db('runs').insert({
                        user_id: user.id,
                        game_id: game.id,
                        username: acc,
                        created_at: new Date()
                    });
                }
            }
            return sendMessage(chatId, `✅ Đã thêm ${accountsArr.length} tài khoản vào game ${game.name}.`);
        }

        if (command === 'deleteacc') {
            const indexOfSpace = args.indexOf(' ');
            const gameId = args.substring(0, indexOfSpace).trim();
            const game = await db('games').where('id', '=', gameId).first();
            const usernamesStr = args.substring(indexOfSpace + 1).trim();
            if (!gameId || !usernamesStr) return sendMessage(chatId, "❗ Sai cú pháp. Ví dụ: /deleteacc 1 tuannguyen,abc,xyz");
            const usernames = usernamesStr.split(',').map(u => u.trim()).filter(u => u.length > 0);
            if (usernames.length === 0) return sendMessage(chatId, "❗ Không có username nào hợp lệ.");
            const deleted = await db('runs')
                .where('game_id', '=', gameId)
                .whereIn('username', usernames)
                .delete();
            return sendMessage(chatId, `✅ Đã xoá ${deleted} tài khoản khỏi game ${game.name}.`);
        }

        if (command === 'viewlogs') {
            const mention = args.trim();
            const target = await getUserByMention(mention);
            if (!target) return sendMessage(chatId, "❗ Không tìm thấy user.");
            const logs = await db('transactions').where('user_id', '=', target.id).orderBy('created_at', 'desc').limit(10).get();
            if (!logs.length) return sendMessage(chatId, "❗ Không có log giao dịch.");
            let text = `📜 10 Giao dịch gần đây của @${target.telegram_username}:\n\n`;
            for (const log of logs) {
                text += `${log.amount > 0 ? '➕' : '➖'} ${log.amount.toLocaleString()}đ - ${new Date(log.created_at).toLocaleString()} (${log.note || ''})\n`;
            }

            const runs = await db('runs')
                .where('user_id', '=', target.id)
                .orderBy('created_at', 'desc')
                .limit(10)
                .get();
            text += `\n📊 Lịch sử chạy 10 acc gần nhất:\n\n`
            if (runs.length === 0) text += `Không có lịch sử chạy nào.`;
            else {
                for (const run of runs) {
                    const game = await db('games').where('id', '=', run.game_id).first();
                    text += `🎮 ${game.name} | ${run.username} | ${run.status ? `${run.bank}` : 'Đang chạy'}\n`;
                }
            }


            return sendMessage(chatId, text);
        }



        if (command === 'ban') {
            const [mention, ...reasonArr] = args.split(/\s+/);
            const reason = reasonArr.join(' ') || 'Không rõ';
            const target = await getUserByMention(mention);
            if (!target) return sendMessage(chatId, "❗ Không tìm thấy user.");
            await db('users').where('id', '=', target.id).update({ status: 0, ban_reason: reason });
            return sendMessage(chatId, `✅ Đã ban @${target.telegram_username}. Lý do: ${reason}`);
        }

        if (command === 'unban') {
            const mention = args.trim();
            const target = await getUserByMention(mention);
            if (!target) return sendMessage(chatId, "❗ Không tìm thấy user.");
            await db('users').where('id', '=', target.id).update({ status: 1, ban_reason: null });
            return sendMessage(chatId, `✅ Đã bỏ ban cho @${target.telegram_username}`);
        }

        if (command === 'setadmin') {
            const mention = args.trim();
            const target = await getUserByMention(mention);
            if (!target) return sendMessage(chatId, "❗ Không tìm thấy user.");
            await db('users').where('id', '=', target.id).update({ role: 'admin' });
            return sendMessage(chatId, `✅ Đã set quyền admin cho @${target.telegram_username}`);
        }

        if (command === 'unsetadmin') {
            const mention = args.trim();
            const target = await getUserByMention(mention);
            if (!target) return sendMessage(chatId, "❗ Không tìm thấy user.");
            await db('users').where('id', '=', target.id).update({ role: 'user' });
            return sendMessage(chatId, `✅ Đã gỡ quyền admin của @${target.telegram_username}`);
        }

        if (command === 'broadcast') {
            const content = args.trim();
            if (!content) return sendMessage(chatId, "❗ Nội dung không được để trống.");
            const users = await db('users').where('status', '=', 1).get();
            for (const u of users) {
                try {
                    await sendMessage(u.telegram_user_id, `📢 Thông báo:\n\n${content}`);
                } catch (e) { }
            }
            return sendMessage(chatId, `✅ Đã gửi broadcast cho ${users.length} user.`);
        }

        if (command === 'viewbalance') {
            const mention = args.trim();
            const target = await getUserByMention(mention);
            if (!target) return sendMessage(chatId, "❗ Không tìm thấy user.");
            return sendMessage(chatId, `💰 Số dư của @${target.telegram_username}: ${target.balance.toLocaleString()}đ`);
        }

        if (command === 'stats') {
            // /stats [ngày/tháng]
            let dateArg = args.trim();
            let start, end;
            if (dateArg) {
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
                    start = new Date(dateArg + "T00:00:00");
                    end = new Date(dateArg + "T23:59:59");
                } else if (/^\d{4}-\d{2}$/.test(dateArg)) {
                    start = new Date(dateArg + "-01T00:00:00");
                    end = new Date(dateArg + "-31T23:59:59");
                }
            }
            let txQuery = db('transactions').where('status', '=', 1).where('note', '=', 'Nạp tiền');
            if (start && end) txQuery = txQuery.whereBetween('created_at', [start, end]);
            const txs = await txQuery.get();
            const totalRevenue = txs.reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0);
            const totalRefund = txs.reduce((sum, t) => sum + (t.amount < 0 ? t.amount : 0), 0);
            const runQuery = db('runs').get();
            if (start && end) runQuery.whereBetween('created_at', [start, end]);
            const totalRuns = (await runQuery).length;
            let text = `📊 Thống kê:\n- Doanh thu: ${totalRevenue.toLocaleString()}đ\n- Số lượng chạy: ${totalRuns}`;
            return sendMessage(chatId, text);
        }

        if (command === 'setprice') {
            const [gameId, priceStr] = args.split(/\s+/);
            const price = parseInt(priceStr);
            if (!gameId || isNaN(price)) return sendMessage(chatId, "❗ Sai cú pháp.");
            const game = await db('games').where('id', '=', gameId).first();
            await db('games').where('id', '=', gameId).update({ price });
            return sendMessage(chatId, `✅ Đã cập nhật giá game ${game.name} thành ${price.toLocaleString()}đ`);
        }
    } catch { }


});



// Crawl bank transactions every 5 minutes
setInterval(checkBankTransactions, 30 * 1000);
