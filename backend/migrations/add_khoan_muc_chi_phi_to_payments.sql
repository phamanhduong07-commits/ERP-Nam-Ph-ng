-- Migration: thêm khoan_muc_chi_phi_id vào cash_payments
-- Chạy lệnh này trên PostgreSQL trước khi restart backend

ALTER TABLE cash_payments
    ADD COLUMN IF NOT EXISTS khoan_muc_chi_phi_id INTEGER
        REFERENCES khoan_muc_chi_phi(id) ON DELETE SET NULL;
