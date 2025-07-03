const TelegramBot = require('node-telegram-bot-api');
const db = require("./database.js")
const usersState = {};
const checkBankTransactions = require('./cron.js');
const ExcelJS = require('exceljs');
const { all } = require('axios');





const homeText = `🎁 HỖ TRỢ NHẬP CODE – HOÀN 100% CHO KHÁCH MỚI 🎁
Áp dụng cho nhà cái:
F8BET | SHBET | 8KBET | MB66 | NEW88 | JUN1 | JUN2 | J88 | Hi88

🧧 CODE 8KBET ~ J88 (RANDOM: 18 / 28 / 38)
💸 Chỉ 5K / 1 lần nhập
🎁 CODE giá trị từ: 18K – 88K
✅ Giá rẻ nhất thị trường
✅ Uy tín tuyệt đối – Không lừa đảo
🔈 ƯU ĐÃI ĐẶC BIỆT
♻️ Auto tự động hoàn cho tài khoản bị lạm dụng .  
📩 Liên hệ hỗ trợ: [@hugo270621] [@tcuccung] [@BeNi2kk]
🛒 Mua code tại BOT: [@HUNTER_CODE_DEN_BOT]
🔈THEO DÕI KÊNH : [https://t.me/HUNTER_BOT12] [https://t.me/codemoiday]
`;





const homeKeyboard = [
    [{ text: '🎯 Chọn game', callback_data: 'choose_game' }],
    [{ text: 'ℹ️ Thông tin', callback_data: 'info' }],
    [{ text: '📞 Chăm sóc khách hàng', callback_data: 'support' }]
];


async function sendMessage(chatId, text, options = {}) {
    try {
        return await bot.sendMessage(chatId, text, options)
    } catch (error) { }
}


// viết hàm trả về excel nguyên cả bảng runs 
// Xuất toàn bộ bảng runs, mỗi trạng thái là một sheet riêng
async function exportAllRunsToExcel(chatId) {
    const runs = await db('runs').orderBy('created_at', 'desc').get();
    if (!runs.length) {
        return sendMessage(chatId, "❗ Không có dữ liệu trong bảng runs.");
    }

    // Lấy thông tin user và game cho mỗi run
    const userIds = [...new Set(runs.map(r => r.user_id))];
    const gameIds = [...new Set(runs.map(r => r.game_id))];
    const users = await db('users').whereIn('id', userIds).get();
    const games = await db('games').whereIn('id', gameIds).get();

    const userMap = {};
    users.forEach(u => userMap[u.id] = u);
    const gameMap = {};
    games.forEach(g => gameMap[g.id] = g);

    // Gom nhóm theo trạng thái
    const grouped = {};
    for (const run of runs) {
        const status = run.status || 'Đang chạy';
        if (!grouped[status]) grouped[status] = [];
        grouped[status].push(run);
    }

    const workbook = new ExcelJS.Workbook();

    for (const status in grouped) {
        const sheet = workbook.addWorksheet(status);

        sheet.columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'User', key: 'user', width: 20 },
            { header: 'Game', key: 'game', width: 18 },
            { header: 'Username', key: 'username', width: 25 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Note', key: 'note', width: 25 },
            { header: 'Created At', key: 'created_at', width: 22 }
        ];

        for (const run of grouped[status]) {
            sheet.addRow({
                id: run.id,
                user: userMap[run.user_id]?.telegram_username || run.user_id,
                game: gameMap[run.game_id]?.name || run.game_id,
                username: run.username,
                status: run.status || 'Đang chạy',
                note: run.note || '',
                created_at: new Date(run.created_at).toLocaleString()
            });
        }

        sheet.eachRow((row, rowNumber) => {
            row.font = { name: 'Arial', size: 12 };
        });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `full_accounts__${Date.now()}.xlsx`;

    await bot.sendDocument(
        chatId,
        Buffer.from(buffer),
        {
            caption: "📊 Toàn bộ dữ liệu đang chạy"
        },
        {
            filename,
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
    );
}


async function exportCustomRunsToExcel(gameIDS, chatId) {
    const runs = await db('runs')
        .whereIn('game_id', gameIDS)
        .orderBy('created_at', 'desc')
        .get();

    if (!runs.length) {
        return sendMessage(chatId, "❗ Không có dữ liệu trong bảng runs cho các game đã chọn.");
    }

    // Lấy thông tin game
    const gameIds = [...new Set(runs.map(r => r.game_id))];
    const games = await db('games').whereIn('id', gameIds).get();
    const gameMap = {};
    games.forEach(g => gameMap[g.id] = g.name);

    // Tạo nội dung txt
    let content = '';
    for (const run of runs) {
        content += `[${gameMap[run.game_id] || run.game_id}][${run.username}]\n`;
    }

    const filename = `accounts_simple_${Date.now()}.txt`;
    await bot.sendDocument(
        chatId,
        Buffer.from(content, 'utf8'),
        {
            caption: "📄 Danh sách tài khoản xuất Simple"
        },
        {
            filename,
            contentType: "text/plain"
        }
    );
}




async function getHistoryGames(chatId, user, message_id = null) {
    const runs = await db('runs')
        .where('user_id', '=', user.id)
        .orderBy('created_at', 'desc')
        .get();


    if (message_id !== null) {
        const limitRuns = await db('runs')
            .where('user_id', '=', user.id)
            .orderBy('created_at', 'desc')
            .limit(10)
            .get();
        let text = `\n📊 Lịch sử chạy (10 acc gần nhất):\n\n`
        if (limitRuns.length === 0) text += `Không có lịch sử chạy nào.`;
        else {
            for (const run of limitRuns) {
                const game = await db('games').where('id', '=', run.game_id).first();
                text += `🎮 ${game.name} | ${run.username} | ${run.status ?? 'Đang chạy'}\n`;
            }
        }

        try {
            await bot.editMessageText(text, {
                chat_id: chatId,
                message_id: message_id,
                reply_markup: backKeyboard("info")
            });
        } catch (error) {

        }
    }


    // Lấy danh sách gameId mà user có dữ liệu
    const gameIds = [...new Set(runs.map(r => r.game_id))];
    const games = await db('games').whereIn('id', gameIds).get();

    // Chuẩn bị workbook
    const workbook = new ExcelJS.Workbook();

    for (const game of games) {
        const sheet = workbook.addWorksheet(game.name);

        // Header
        sheet.columns = [
            { header: 'Tên tài khoản', key: 'username', width: 30 },
            { header: 'Trạng thái', key: 'status', width: 15 },
            { header: 'Note', key: 'note', width: 30 },
            { header: 'Thời gian thêm', key: 'created_at', width: 22 }
        ];

        // Font cho toàn bộ sheet
        sheet.eachRow((row) => {
            row.font = { name: 'Times New Roman', size: 13 };
        });

        // Lấy các run của game này
        const runsOfGame = runs.filter(r => r.game_id === game.id);

        for (const run of runsOfGame) {
            sheet.addRow({
                username: run.username,
                status: run.status || 'Đang chạy',
                note: run.note,
                created_at: new Date(run.created_at).toLocaleString()
            });
        }

        // Set font cho header và các row
        sheet.eachRow((row, rowNumber) => {
            row.font = { name: 'Arial', size: 13 };
        });
    }

    // Ghi file ra buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `lich_su_chay_${user.telegram_username || user.id}_${Date.now()}.xlsx`;

    await bot.sendDocument(
        chatId,
        Buffer.from(buffer),
        {
            caption: "\n\n📊 Lịch sử chạy của " + user.telegram_username
        },
        {
            filename, // filename phải kết thúc bằng .xlsx, không có .zip
            contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
    );
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
            return await sendMessage(chatId, text, options);
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
    if (!username) {
        // console.error("User does not have a Telegram username!");
        return;  // hoặc throw error, hoặc xử lý theo logic của bạn
    }

    const exists = await db('users').where('telegram_username', '=', username).first();
    if (!exists) {
        try {
            await db('users').insert({
                telegram_user_id: telegramId,
                telegram_username: username,
                balance: 0
            });
        } catch (error) { }

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

    await sendMessage(chatId, "Welcome To Hunter Bot!", {
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
            return await sendMessage(chatId, "❗ Tài khoản của bạn đã bị cấm với lý do: " + (user.ban_reason || "Không rõ"));


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
                [{ text: '📜 Lịch sử nạp', callback_data: 'history' }],
                [{ text: '📜 Lịch sử chạy', callback_data: 'history_games' }],
                [{ text: '🔙 Quay lại', callback_data: 'back_home' }]
            ];
            return sendOrEdit(chatId, text, keyboard, messageId);
        }


        /// Page 3 ///

        if (data === 'balance') {
            const balance = user?.balance || 0;

            try {
                await bot.editMessageText(`💰 Số dư hiện tại của bạn là: ${balance.toLocaleString()}đ`, {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: backKeyboard("info")
                });
            } catch (error) {

            }

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

            try {
                await bot.editMessageText(text, {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: backKeyboard("info")
                });



            } catch (error) {

            }


        }


        if (data === 'history_games') {
            await getHistoryGames(chatId, user, messageId)
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
            let existedAccounts = [];
            let addedCount = 0;

            for (let acc of accounts) {
                // Kiểm tra account đã tồn tại chưa (theo username, bank, user_id, game_id)
                let query = db('runs')
                    .where('game_id', '=', game.id)
                    .where('username', '=', acc.username)
                    .whereNull("status")

                const existed = await query.first();
                if (existed) {
                    existedAccounts.push(acc.username);
                    continue;
                }

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

                addedCount++;
            }

            if (addedCount > 0) {
                await db('users').where('id', '=', user.id).update({
                    balance: user.balance - (addedCount * game.price)
                });
            }

            let msg = `✅ Đã thêm ${addedCount} tài khoản cho game "${game.name}". Số dư còn lại: ${(user.balance - (addedCount * game.price)).toLocaleString()}đ`;
            if (existedAccounts.length) {
                msg += `\n\n❗ Các tài khoản đã tồn tại và không được thêm: ${existedAccounts.join(', ')}`;
            }
            await sendMessage(chatId, msg);
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
                    .whereNull('status')
                    .first();


                if (run) {
                    // Refund 80% giá game

                    // Đánh dấu run đã refund (nếu muốn)
                    await db('runs').where('id', '=', run.id).update({ status: 'refunding' });
                    refunded++;
                } else {
                    notFound.push(username);
                }
            }

            let msg = `✅ Đã refund ${refunded} tài khoản (${(refunded * Math.floor(game.price * 0.7)).toLocaleString()}đ) cho game ${game.name}. Refund sẽ được cập nhật tối đa sau 30 giây.`;
            if (notFound.length) {
                msg += `\n\n❗ Tài khoản không thể refund: ${notFound.join(', ')}`;
            }
            await sendMessage(chatId, msg);
            usersState[chatId] = null;
        }
    } catch (error) {
        console.log(error)
    }


});




bot.onText(/^\/(\w+)(.*)/, async (msg, match) => {


    try {
        const chatId = msg.chat.id;
        const username = msg.from.username;
        if (!username) return await sendMessage(chatId, "❗ Bạn cần đặt username Telegram để sử dụng lệnh.");
        const user = await db('users').where('telegram_username', '=', username).first();
        if (!user) return await sendMessage(chatId, "❗ Không tìm thấy thông tin tài khoản.");
        if (user.status === 0) return await sendMessage(chatId, "❗ Tài khoản của bạn đã bị cấm với lý do: " + (user.ban_reason || "Không rõ"));
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
            'ban', 'unban', 'setadmin', 'unsetadmin', 'broadcast', 'viewbalance', 'stats', 'setprice', 'viewaccs', 'checkhoantien'
        ];
        const modCmds = [
            'congtien', 'refund', 'addacc', 'deleteacc', 'viewlogs', 'viewbalance', 'broadcast', 'ban'
        ];



        if (role === 'admin' || command == 'start') {
            ////// 
        } else {
            // Nếu user có allowed_commands thì chỉ cho phép các lệnh này
            let allowed = [];
            if (user.allowed_commands) {
                allowed = JSON.parse(user.allowed_commands);
            }
            if (!allowed.includes(command)) {
                return sendMessage(chatId, "❗ Bạn không có quyền sử dụng lệnh này.");
            }
        }

        if (command !== ''){

            let log = msg.text;
            // lưu log vào user_commands
            await db('user_commands').insert({
                user_id: user.id,
                command: log,
                created_at: new Date()
            });


        }


        if (command === 'chidinhlenh' && role === 'admin') {
            const [mention, ...cmds] = args.split(/\s+/);
            const user = await getUserByMention(mention);
            if (!user) return sendMessage(chatId, "❗ Không tìm thấy user.");
            const allowed = cmds.join(' ').split(',').map(s => s.trim()).filter(Boolean);
            console.log(allowed)
            if (!allowed.length) return sendMessage(chatId, "❗ Bạn phải nhập ít nhất 1 lệnh.");
            await db('users').where('id', "=", user.id).update({
                allowed_commands: JSON.stringify(allowed)
            });
            return sendMessage(chatId, `✅ Đã chỉ định lệnh cho @${user.telegram_username}: ${allowed.join(', ')}`);
        }


        if (command === 'xoachidinh' && role === 'admin') {
            const [mention, ...cmds] = args.split(/\s+/);
            const user = await getUserByMention(mention);
            if (!user) return sendMessage(chatId, "❗ Không tìm thấy user.");
            let allowed = [];
            if (user.allowed_commands) {
                allowed = JSON.parse(user.allowed_commands);
            }
            const removeCmds = cmds.join(' ').split(',').map(s => s.trim()).filter(Boolean);
            allowed = allowed.filter(cmd => !removeCmds.includes(cmd));
            await db('users').where('id', '=', user.id).update({
                allowed_commands: allowed.length ? JSON.stringify(allowed) : null
            });
            return sendMessage(chatId, `✅ Đã xóa chỉ định lệnh cho @${user.telegram_username}: ${removeCmds.join(', ')}`);
        }



        // ...existing code...

        if (command === 'dashboard') {


            try {
                // Tổng số lượng người dùng
                const totalUsers = await db('users').count('id').first();

                // Tổng số đơn hàng đang chạy của từng loại game (status = null)
                const runningOrders = await db('runs')
                    .select('game_id')
                    .whereNull('status')
                    .count('id')
                    .groupBy('game_id').get();






                // Lấy tên game
                const gameIds = runningOrders.map(r => r.game_id);
                console.log(gameIds)
                const games = await db('games').whereIn('id', gameIds).get();
                const gameMap = {};
                games.forEach(g => gameMap[g.id] = g.name);

                // Tổng số đơn đã refund
                const refundedOrders = await db('runs').where('status', '=', 'refunded').count('id').first();

                // Tổng số tiền khách đã nạp (note = Nạp tiền)
                const totalDeposit = await db('transactions')
                    .where('note', '=', 'Nạp tiền')
                    .where('status', '=', 1)
                    .sum('amount')
                    .first();

                let text = `📊 DASHBOARD\n\n`;
                text += `👤 Tổng số người dùng: ${totalUsers.count}\n\n`;
                text += `🟢 Đơn hàng đang chạy:\n`;
                if (runningOrders.length === 0) {
                    text += `- Không có đơn nào đang chạy\n`;
                } else {
                    for (const r of runningOrders) {
                        text += `- ${gameMap[r.game_id] || r.game_id}: ${r.count}\n`;
                    }
                }
                text += `\n♻️ Tổng số đơn đã refund: ${refundedOrders.count}\n`;
                text += `\n💰 Tổng số tiền khách đã nạp: ${(totalDeposit.sum || 0).toLocaleString()}đ`;

                return await sendMessage(chatId, text);
            } catch (error) {

            }


        }


        if (command === 'refund') {
            // /refund <gameId> <username>
            const [gameId, username] = args.split(/\s+/);
            if (!gameId || !username) return await sendMessage(chatId, "❗ Sai cú pháp. Ví dụ: /refund 1 username");
            const game = await db('games').where('id', '=', gameId).first();
            if (!game) return await sendMessage(chatId, "❗ Không tìm thấy game.");

            // Chỉ hoàn 1 tài khoản/lần, tìm run trạng thái null hoặc account_error
            const run = await db('runs')
                .where('game_id', '=', game.id)
                .where('username', '=', username)
                .whereIn('status', [null, 'account_error'])
                .first();

            if (run) {
                // Đánh dấu run đang refunding
                await db('runs').where('id', '=', run.id).update({ status: 'refunding' });
                const refundAmount = Math.floor(game.price * 0.8);
                let msg = `✅ Đã gửi yêu cầu hoàn tiền tài khoản "${username}" (${refundAmount.toLocaleString()}đ) cho game ${game.name}. Lưu ý tiền sẽ về sau tối đa 30s.`;
                return await sendMessage(chatId, msg);
            } else {
                return await sendMessage(chatId, `❗ Tài khoản ${username} của game ${game.name} không hợp lệ để hoàn tiền.`);
            }
        }

        // Command handlers
        if (command === 'congtien') {
            const [mention, amountStr] = args.split(/\s+/);
            const target = await getUserByMention(mention);
            const amount = parseInt(amountStr);
            if (!target || isNaN(amount)) return await sendMessage(chatId, "❗ Sai cú pháp hoặc không tìm thấy user.");
            await db('users').where('id', '=', target.id).increment('balance', amount);
            await db('transactions').insert({
                user_id: target.id,
                amount: amount,
                status: 1,
                created_at: new Date(),
                note: `Admin cộng tiền`
            });
            return await sendMessage(chatId, `✅ Đã cộng ${amount.toLocaleString()}đ cho @${target.telegram_username}`);
        }

        if (command === 'trutien') {
            const [mention, amountStr] = args.split(/\s+/);
            const target = await getUserByMention(mention);
            const amount = parseInt(amountStr);
            if (!target || isNaN(amount)) return await sendMessage(chatId, "❗ Sai cú pháp hoặc không tìm thấy user.");
            await db('users').where('id', '=', target.id).decrement('balance', amount);
            await db('transactions').insert({
                user_id: target.id,
                amount: -amount,
                status: 1,
                created_at: new Date(),
                note: `Admin trừ tiền`
            });
            return await sendMessage(chatId, `✅ Đã trừ ${amount.toLocaleString()}đ của @${target.telegram_username}`);
        }

        if (command === 'resetbalance') {
            const mention = args.trim();
            const target = await getUserByMention(mention);
            if (!target) return await sendMessage(chatId, "❗ Không tìm thấy user.");
            await db('users').where('id', '=', target.id).update({ balance: 0 });
            await db('transactions').insert({
                user_id: target.id,
                amount: -target.balance,
                status: 1,
                created_at: new Date(),
                note: `Admin reset số dư`
            });
            return await sendMessage(chatId, `✅ Đã reset số dư về 0 cho @${target.telegram_username}`);
        }

        if (command === 'addacc') {
            const [gameId, ...rest] = args.split(/\s+/);
            const accountsStr = rest.join(' ');
            const accountsArr = accountsStr.split(',').map(a => a.trim()).filter(a => a.length > 0);
            const game = await db('games').where('id', '=', gameId).first();
            if (!game) return await sendMessage(chatId, "❗ Không tìm thấy game.");


            let existedAccounts = [];


            if (game.is_need_bank) {
                // Mỗi acc: username bank (cách nhau bởi dấu cách)
                for (const acc of accountsArr) {
                    const [username, bank] = acc.split(/\s+/);
                    if (!username || !bank) continue;
                    let query = db('runs')
                        .where('game_id', '=', game.id)
                        .where('username', '=', username)
                        .whereNull("status")

                    const existed = await query.first();
                    if (existed) {
                        existedAccounts.push(username);
                        continue;
                    }



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

                    let query = db('runs')
                        .where('game_id', '=', game.id)
                        .where('username', '=', acc)
                        .whereNull("status")

                    const existed = await query.first();
                    if (existed) {
                        existedAccounts.push(acc);
                        continue;
                    }


                    await db('runs').insert({
                        user_id: user.id,
                        game_id: game.id,
                        username: acc,
                        created_at: new Date()
                    });
                }
            }

            let msg = `✅ Đã thêm ${accountsArr.length - existedAccounts.length} tài khoản vào game ${game.name}.`;
            if (existedAccounts.length) {
                msg += `\n\n❗ Các tài khoản đã tồn tại và không được thêm: ${existedAccounts.join(', ')}`;
            }
            return await sendMessage(chatId, msg);
        }

        if (command === 'deleteacc') {
            const indexOfSpace = args.indexOf(' ');
            const gameId = args.substring(0, indexOfSpace).trim();
            const game = await db('games').where('id', '=', gameId).first();
            const usernamesStr = args.substring(indexOfSpace + 1).trim();
            if (!gameId || !usernamesStr) return await sendMessage(chatId, "❗ Sai cú pháp. Ví dụ: /deleteacc 1 tuannguyen,abc,xyz");
            const usernames = usernamesStr.split(',').map(u => u.trim()).filter(u => u.length > 0);
            if (usernames.length === 0) return await sendMessage(chatId, "❗ Không có username nào hợp lệ.");
            const deleted = await db('runs')
                .where('game_id', '=', gameId)
                .where("status", "=", null)
                .whereIn('username', usernames)
                .delete();
            return await sendMessage(chatId, `✅ Đã xoá ${deleted} tài khoản khỏi game ${game.name}.`);
        }

        if (command === "viewaccs") {


            return await exportAllRunsToExcel(chatId)

        }

        if (command === 'viewlogs') {
            const mention = args.trim();
            const target = await getUserByMention(mention);
            if (!target) return await sendMessage(chatId, "❗ Không tìm thấy user.");
            const logs = await db('transactions').where('user_id', '=', target.id).orderBy('created_at', 'desc').limit(10).get();
            if (!logs.length) return await sendMessage(chatId, "❗ Không có log giao dịch.");
            let text = `📜 10 Giao dịch gần đây của @${target.telegram_username}:\n\n`;
            for (const log of logs) {
                text += `${log.amount > 0 ? '➕' : '➖'} ${log.amount.toLocaleString()}đ - ${new Date(log.created_at).toLocaleString()} (${log.note || ''})\n`;
            }



            await getHistoryGames(chatId, target)
            return await sendMessage(chatId, text);
        }



        if (command === 'ban') {
            const [mention, ...reasonArr] = args.split(/\s+/);
            const reason = reasonArr.join(' ') || 'Không rõ';
            const target = await getUserByMention(mention);
            if (!target) return await sendMessage(chatId, "❗ Không tìm thấy user.");
            await db('users').where('id', '=', target.id).update({ status: 0, ban_reason: reason });
            return await sendMessage(chatId, `✅ Đã ban @${target.telegram_username}. Lý do: ${reason}`);
        }

        if (command === 'unban') {
            const mention = args.trim();
            const target = await getUserByMention(mention);
            if (!target) return await sendMessage(chatId, "❗ Không tìm thấy user.");
            await db('users').where('id', '=', target.id).update({ status: 1, ban_reason: null });
            return await sendMessage(chatId, `✅ Đã bỏ ban cho @${target.telegram_username}`);
        }

        if (command === 'setadmin') {
            const mention = args.trim();
            const target = await getUserByMention(mention);
            if (!target) return await sendMessage(chatId, "❗ Không tìm thấy user.");
            await db('users').where('id', '=', target.id).update({ role: 'admin' });
            return await sendMessage(chatId, `✅ Đã set quyền admin cho @${target.telegram_username}`);
        }

        if (command === 'unsetadmin') {
            const mention = args.trim();
            const target = await getUserByMention(mention);
            if (!target) return await sendMessage(chatId, "❗ Không tìm thấy user.");
            await db('users').where('id', '=', target.id).update({ role: 'user' });
            return await sendMessage(chatId, `✅ Đã gỡ quyền admin của @${target.telegram_username}`);
        }

        if (command === 'broadcast') {
            const content = msg.text.split('\n').slice(1).join('\n').trim();
            if (!content) return await sendMessage(chatId, "❗ Nội dung không được để trống. Chú ý nội dung tin là xuống dòng sau /broadcast.");

            // chỉnh content để có thể gửi xuống dòng, ví dụ 
            // /broadcast
            // chào ngày mới
            // bạn khỏe không

            const users = await db('users').whereNotNull("telegram_user_id").where('status', '=', 1).get();
            await sendMessage(chatId, `✅ Đang gửi tin broadcast... Vui lòng không gửi lại và đợi trong giây lát...`);
            for (const u of users) {
                try {
                    await sendMessage(u.telegram_user_id, `📢 Thông báo:\n\n${content}`);
                } catch (e) { }
            }
            return await sendMessage(chatId, `✅ Đã gửi broadcast cho ${users.length} user.`);
        }


        // tính năng /checkacc : Ví dụ /checkac abcd1234 . thì hiện thông tin lịch sử run của user abcd1234 (full game), ngày giờ thêm , và tình trạng done,refund hay lạm dụng .

        if (command === 'checkacc') {
            const mention = args.trim();
            const target = await getUserByMention(mention);
            if (!target) return await sendMessage(chatId, "❗ Không tìm thấy user.");


            // if (!findUser) return await sendMessage(chatId, `❗ Không tìm thấy tài khoản ${username} trong hệ thống.`);
            const runs = await db('runs')
                .where('user_id', '=', target.id)
                .orderBy('created_at', 'desc')
                .get();

            const username = target.telegram_username;
            let text = `📜 Lịch sử tài khoản "${username}":\n\n`;
            for (const run of runs) {
                const game = await db('games').where('id', '=', run.game_id).first();
                text += `\n[${game ? game.name : 'Không rõ'}]`;
                text += `[${new Date(run.created_at).toLocaleString()}]`;
                text += `[${run.status || 'Đang chạy'}]`;
                if (run.note !== null) {
                    text += `[${run.note}]`;
                }

            }

            return await sendMessage(chatId, text);

        }

        if (command === 'viewbalance') {
            const mention = args.trim();
            const target = await getUserByMention(mention);
            if (!target) return await sendMessage(chatId, "❗ Không tìm thấy user.");
            return await sendMessage(chatId, `💰 Số dư của @${target.telegram_username}: ${target.balance.toLocaleString()}đ`);
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
            return await sendMessage(chatId, text);
        }

        if (command === 'setprice') {
            const [gameId, priceStr] = args.split(/\s+/);
            const price = parseInt(priceStr);
            if (!gameId || isNaN(price)) return await sendMessage(chatId, "❗ Sai cú pháp.");
            const game = await db('games').where('id', '=', gameId).first();
            await db('games').where('id', '=', gameId).update({ price });
            return await sendMessage(chatId, `✅ Đã cập nhật giá game ${game.name} thành ${price.toLocaleString()}đ`);
        }


        if (command === 'xuatsimple') {


            return await exportCustomRunsToExcel([1, 2, 3], chatId)

        }

        // lệnh checkqtv = kiểm tra 20 lệnh gần nhất của user đó 
        if (command === 'checkqtv') {
            const mention = args.trim();
            const target = await getUserByMention(mention);
            if (!target) return await sendMessage(chatId, "❗ Không tìm thấy user.");
            
            // 20 lệnh trong bot ở bảng user_commands gần nhất của qtv đó
            const commands = await db('user_commands')
                .where('user_id', '=', target.id)
                .orderBy('created_at', 'desc')
                .limit(20)
                .get();
            if (!commands.length) return await sendMessage(chatId, "❗ Không có lệnh nào được ghi nhận.");
            let text = `📜 20 lệnh gần nhất của @${target.telegram_username}:\n\n`
            for (const cmd of commands) {
                text += `[${cmd.command}] (${new Date(cmd.created_at).toLocaleString()})\n`;
            }
            

            return await sendMessage(chatId, text);
        }   




    } catch { }


});

bot.on("polling_error", (err) => { });


// Crawl bank transactions every 5 minutes
setInterval(checkBankTransactions, 30 * 1000);



async function checkRefunds() {
    // 1. Lấy tất cả các runs đang refunding
    const refundingRuns = await db('runs').where('status', '=', 'refunding').get();
    for (const run of refundingRuns) {
        // 2. Lấy user và game tương ứng
        const user = await db('users').where('id', '=', run.user_id).first();
        const game = await db('games').where('id', '=', run.game_id).first();
        if (!user || !game) continue;

        // 3. Tính số tiền refund (80%)
        const refundAmount = game.price * 0.8;

        // 4. Cộng tiền cho user
        await db('users').where('id', '=', user.id).increment('balance', refundAmount);

        // 5. Ghi log giao dịch
        await db('transactions').insert({
            user_id: user.id,
            amount: refundAmount,
            status: 1,
            created_at: new Date(),
            note: `Refund tài khoản ${run.username} game ${game.name}_runid=${run.id}`
        });

        // 6. Đánh dấu run đã refund xong
        await db('runs').where('id', '=', run.id).update({ status: 'refunded' });
    }
}

// Chạy mỗi 30 giây
setInterval(checkRefunds, 30 * 1000);


// 
// lắng nghe tin nhắn trong 1 group 
// với trường mỗi dòng sẽ là [tên game][username của game][ket qua]
// [lll99][username][45]
// 
// - Đầu tiên hãy lấy ra gameId của tên game đó 
// - Đọc kết quả
// + Nếu kết quả là số tự nhiên thì update cái status của run đó về done, note = số tự nhiên đó
// + Nếu kết quả là ngược lại thì refund 80% số tiền, update status = account_error + kết quả chạy

bot.on('message', async (msg) => {
    try {
        // Chỉ xử lý nếu là group (supergroup) và không phải bot gửi
        if (!msg.chat || (msg.chat.type !== 'group' && msg.chat.type !== 'supergroup')) return;
        if (msg.from.is_bot) return;
        if (!msg.text) return;

        const groupId = msg.chat.id;

        if (groupId !== parseInt(process.env.SIMPLE_GROUP)) return;

        // Mỗi dòng: [tên game][username][kết quả]
        const lines = msg.text.split('\n').map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
            const match = line.match(/^\[(.+?)\]\[(.+?)\]\[(.+?)\]\[(.+?)\]$/);
            if (!match) continue;
            let [_, gameName, username, code, result] = match;

            // Lấy gameId từ tên game
            const game = await db('games').where('name', '=', gameName).first();
            if (!game) continue;

            // Tìm run chưa hoàn thành
            const run = await db('runs')
                .where('game_id', '=', game.id)
                .where('username', '=', username)
                .whereNull('status')
                .first();
            if (!run) continue;

            // get telegram_user_id từ run.user_id
            const user = await db('users').where('id', '=', run.user_id).first();
            if (!user) continue;
            const chatId = user.telegram_user_id;

            if (/^\d+$/.test(result) || result == "Đã nhận") {
                // Kết quả là số tự nhiên: done

                if (result == "Đã nhận") {
                    result = "Đã nhận code " + code;
                }

                await db('runs').where('id', '=', run.id).update({
                    status: 'done',
                    note: result
                });

                let text = `📢 📢  Code mới ${game.name} đây: ${username} | ${result}`;
                await sendMessage(chatId, text);

            } else {
                // Kết quả khác: refund 80%
                await db('runs').where('id', '=', run.id).update({
                    status: 'account_error',
                    note: result
                });

                if (result.includes("đã lâu chưa phát sinh") ||
                    result.includes("chưa cập nhật thông tin") ||
                    result.includes("không thuộc nhóm phù hợp") ||
                    result.includes("đã nhận thưởng hôm nay")
                ) {

                    await db('runs').where('id', '=', run.id).update({
                        status: 'refunding'
                    });


                    let text = `📢 📢  Code mới ${game.name} đây: ${username} | ${result}`;
                    await sendMessage(chatId, text);


                    let msg = `✅ Refund tài khoản ${user} cho game ${game.name}. Refund sẽ được cập nhật tối đa sau 30 giây.`;
                    await sendMessage(chatId, msg);
                }




            }
        }
    } catch (err) {
        console.log('Group message error:', err);
    }
});