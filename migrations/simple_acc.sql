-- Thêm cột is_exported tinyint (mặc định 0) vào bảng runs
ALTER TABLE runs
ADD COLUMN is_exported tinyint NOT NULL DEFAULT 0;
