-- 创建订单收款记录表
CREATE TABLE IF NOT EXISTS "OrderPaymentCollection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "declarationId" TEXT,
  "channelUnitPricePhp" DECIMAL(10,2) NOT NULL,
  "receivableFreightAmount" DECIMAL(10,2) NOT NULL,
  "receivableOtherAmount" DECIMAL(10,2),
  "actualReceivedAmount" DECIMAL(10,2) NOT NULL,
  "channelFreightCost" DECIMAL(10,2),
  "channelOtherCost" DECIMAL(10,2),
  "profit" DECIMAL(10,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderPaymentCollection_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "QuickOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderPaymentCollection_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "OrderDeclaration"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 创建订单收款凭证表
CREATE TABLE IF NOT EXISTS "OrderPaymentVoucher" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "paymentCollectionId" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT,
  "fileType" TEXT,
  "fileSize" INTEGER,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderPaymentVoucher_paymentCollectionId_fkey" FOREIGN KEY ("paymentCollectionId") REFERENCES "OrderPaymentCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS "OrderPaymentCollection_orderId_idx" ON "OrderPaymentCollection"("orderId");
CREATE INDEX IF NOT EXISTS "OrderPaymentCollection_declarationId_idx" ON "OrderPaymentCollection"("declarationId");
CREATE INDEX IF NOT EXISTS "OrderPaymentCollection_createdAt_idx" ON "OrderPaymentCollection"("createdAt");
CREATE INDEX IF NOT EXISTS "OrderPaymentVoucher_paymentCollectionId_idx" ON "OrderPaymentVoucher"("paymentCollectionId");
