-- Manual migration: Remove fileSize column from OrderPaymentVoucher
-- Date: 2026-04-18

ALTER TABLE "OrderPaymentVoucher" DROP COLUMN IF EXISTS "fileSize";
