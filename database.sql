CREATE TABLE games (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price INT NOT NULL,  -- số tiền quy định cho mỗi code
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    telegram_username VARCHAR(100) NOT NULL UNIQUE,
    balance DECIMAL(12, 2) DEFAULT 0, -- số dư
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    status TINYINT(1) DEFAULT 0, -- 0 = pending, 1 = done
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE runs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,             -- người yêu cầu chạy
    game_id INT NOT NULL,             -- game liên quan
    username VARCHAR(100) NOT NULL,   -- tên tài khoản game
    bank VARCHAR(100),                -- phương thức thanh toán / nguồn (nếu có)
    status VARCHAR(255),              -- "done" hoặc message lỗi như "code không hợp lệ"
    points INT DEFAULT 0,             -- điểm thu được từ code
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
