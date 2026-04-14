-- Manual migration: Change OrderPaymentVoucher to relate to QuickOrder instead of OrderPaymentCollection
-- Date: 2026-04-14

-- Step 1: Add new orderId column
ALTER TABLE "OrderPaymentVoucher" ADD COLUMN "orderId" TEXT;

-- Step 2: Populate orderId from paymentCollectionId (migration existing data)
UPDATE "OrderPaymentVoucher" 
SET "orderId" = (
  SELECT "orderId" 
  FROM "OrderPaymentCollection" 
  WHERE "OrderPaymentCollection"."id" = "OrderPaymentVoucher"."paymentCollectionId"
);

-- Step 3: Make orderId NOT NULL (all records should have orderId now)
ALTER TABLE "OrderPaymentVoucher" ALTER COLUMN "orderId" SET NOT NULL;

-- Step 4: Drop old foreign key constraint
ALTER TABLE "OrderPaymentVoucher" 
DROP CONSTRAINT IF EXISTS "OrderPaymentVoucher_paymentCollectionId_fkey";

-- Step 5: Drop old index
DROP INDEX IF EXISTS "OrderPaymentVoucher_paymentCollectionId_idx";

-- Step 6: Drop old column
ALTER TABLE "OrderPaymentVoucher" DROP COLUMN "paymentCollectionId";

-- Step 7: Create new foreign key constraint
ALTER TABLE "OrderPaymentVoucher"
ADD CONSTRAINT "OrderPaymentVoucher_orderId_fkey" 
FOREIGN KEY ("orderId") REFERENCES "QuickOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 8: Create new index
CREATE INDEX "OrderPaymentVoucher_orderId_idx" ON "OrderPaymentVoucher"("orderId");

-- Step 9: Remove paymentVouchers relation from OrderPaymentCollection (this is handled in Prisma schema)
-- No SQL needed - just removing the field from schema
