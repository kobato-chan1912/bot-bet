-- Viết SQL tạo bảng lưu trữ các lệnh được sử dụng bởi các users --
CREATE TABLE IF NOT EXISTS user_commands (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    command TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);