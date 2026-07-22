-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('CUSTOMER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "QuickOrderType" AS ENUM ('SEA_LCL', 'AIR', 'LAND', 'SEA_FCL', 'PARCEL', 'BATCH');

-- CreateEnum
CREATE TYPE "QuickOrderStatus" AS ENUM ('LOADING', 'SAILING', 'ARRIVED', 'CUSTOMS', 'DISPATCHING');

-- CreateEnum
CREATE TYPE "ContainerType" AS ENUM ('GP_20', 'GP_40', 'HQ_40', 'HQ_45');

-- CreateEnum
CREATE TYPE "BatchImportStatus" AS ENUM ('UPLOADING', 'PARSING', 'COMPLETED', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "UserRoleEnum" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "OrderVoucherType" AS ENUM ('PAYMENT', 'RECEIPT', 'OVERSEAS_RECEIPT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "company" TEXT,
    "userType" "UserType" NOT NULL DEFAULT 'CUSTOMER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "userRole" "UserRoleEnum" NOT NULL DEFAULT 'USER',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderType" "QuickOrderType" NOT NULL,
    "warehouse" TEXT,
    "destination" TEXT NOT NULL,
    "note" TEXT,
    "userMark" TEXT,
    "mark" TEXT,
    "originPort" TEXT,
    "destinationPort" TEXT,
    "voyageNumber" TEXT,
    "airWaybillNumber" TEXT,
    "billOfLading" TEXT,
    "containerNumber" TEXT,
    "bookingChannel" TEXT,
    "customsDeclarationChannel" TEXT,
    "customsClearanceChannel" TEXT,
    "loadingDate" TIMESTAMP(3),
    "eta" TIMESTAMP(3),
    "totalShippingDays" INTEGER,
    "batchTaskId" TEXT,
    "status" "QuickOrderStatus" NOT NULL DEFAULT 'LOADING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "recipientAddressId" TEXT NOT NULL,
    "overseasAddressId" TEXT,
    "markUserId" TEXT,
    "shippedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "overseasReceivedAt" TIMESTAMP(3),

    CONSTRAINT "QuickOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderRecipientAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT NOT NULL,
    "region" TEXT,
    "address" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderRecipientAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderOverseasAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT NOT NULL,
    "region" TEXT,
    "address" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderOverseasAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderDeclaration" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "trackingNumber" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "length" DECIMAL(8,2),
    "width" DECIMAL(8,2),
    "height" DECIMAL(8,2),
    "weight" DECIMAL(10,3) NOT NULL,
    "cnyUnitPrice" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "phpUnitPrice" DECIMAL(10,2),
    "channelUnitPriceCny" DECIMAL(10,2),
    "channelUnitPricePhp" DECIMAL(10,2),

    CONSTRAINT "OrderDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderContainer" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "containerType" "ContainerType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "weight" DECIMAL(10,2),
    "productsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderContainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BatchImportTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "warehouse" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "status" "BatchImportStatus" NOT NULL DEFAULT 'UPLOADING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "errorLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BatchImportTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "trackingNumber" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "originPort" TEXT,
    "destinationPort" TEXT,
    "departureDate" TIMESTAMP(3),
    "arrivalDate" TIMESTAMP(3),
    "estimatedArrival" TIMESTAMP(3),
    "currentLocation" TEXT,
    "currentLat" DOUBLE PRECISION,
    "currentLng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "quickOrderId" TEXT,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "stripePaymentId" TEXT,
    "paymentMethod" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "quickOrderId" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderPaymentCollection" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "totalPieces" INTEGER NOT NULL DEFAULT 0,
    "totalVolume" DECIMAL(12,4),
    "totalWeight" DECIMAL(10,3),
    "receivableAmount" DECIMAL(10,2) NOT NULL,
    "payableAmount" DECIMAL(10,2) NOT NULL,
    "receivableCurrency" TEXT NOT NULL DEFAULT 'CNY',
    "payableCurrency" TEXT NOT NULL DEFAULT 'PHP',
    "carPickupReceivable" DECIMAL(10,2),
    "carPickupActual" DECIMAL(10,2),
    "oceanFreight" DECIMAL(10,2),
    "bookingFee" DECIMAL(10,2),
    "portGateFee" DECIMAL(10,2),
    "truckingFee" DECIMAL(10,2),
    "customsCertFee" DECIMAL(10,2),
    "thcOverstayFee" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderPaymentCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderPaymentVoucher" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "fileType" TEXT,
    "voucherType" "OrderVoucherType" NOT NULL DEFAULT 'PAYMENT',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderPaymentVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "VerificationCode_phone_type_verified_idx" ON "VerificationCode"("phone", "type", "verified");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "QuickOrder_orderNumber_key" ON "QuickOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "QuickOrder_userId_orderType_status_createdAt_idx" ON "QuickOrder"("userId", "orderType", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "QuickOrder_markUserId_orderType_status_createdAt_idx" ON "QuickOrder"("markUserId", "orderType", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "QuickOrder_orderNumber_idx" ON "QuickOrder"("orderNumber");

-- CreateIndex
CREATE INDEX "QuickOrder_batchTaskId_idx" ON "QuickOrder"("batchTaskId");

-- CreateIndex
CREATE INDEX "QuickOrder_createdAt_idx" ON "QuickOrder"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "OrderRecipientAddress_userId_isDefault_idx" ON "OrderRecipientAddress"("userId", "isDefault");

-- CreateIndex
CREATE INDEX "OrderRecipientAddress_userId_updatedAt_idx" ON "OrderRecipientAddress"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderRecipientAddress_userId_phone_key" ON "OrderRecipientAddress"("userId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "OrderRecipientAddress_userId_phone_name_key" ON "OrderRecipientAddress"("userId", "phone", "name");

-- CreateIndex
CREATE INDEX "OrderOverseasAddress_userId_isDefault_idx" ON "OrderOverseasAddress"("userId", "isDefault");

-- CreateIndex
CREATE INDEX "OrderOverseasAddress_userId_updatedAt_idx" ON "OrderOverseasAddress"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderOverseasAddress_userId_phone_key" ON "OrderOverseasAddress"("userId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "OrderOverseasAddress_userId_phone_name_key" ON "OrderOverseasAddress"("userId", "phone", "name");

-- CreateIndex
CREATE INDEX "OrderDeclaration_orderId_idx" ON "OrderDeclaration"("orderId");

-- CreateIndex
CREATE INDEX "OrderDeclaration_productName_idx" ON "OrderDeclaration"("productName");

-- CreateIndex
CREATE INDEX "OrderContainer_orderId_idx" ON "OrderContainer"("orderId");

-- CreateIndex
CREATE INDEX "BatchImportTask_userId_status_createdAt_idx" ON "BatchImportTask"("userId", "status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_trackingNumber_key" ON "Shipment"("trackingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_quickOrderId_key" ON "Shipment"("quickOrderId");

-- CreateIndex
CREATE INDEX "TrackingEvent_shipmentId_timestamp_idx" ON "TrackingEvent"("shipmentId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_quickOrderId_key" ON "Payment"("quickOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderPaymentCollection_orderId_key" ON "OrderPaymentCollection"("orderId");

-- CreateIndex
CREATE INDEX "OrderPaymentCollection_orderId_idx" ON "OrderPaymentCollection"("orderId");

-- CreateIndex
CREATE INDEX "OrderPaymentCollection_createdAt_idx" ON "OrderPaymentCollection"("createdAt");

-- CreateIndex
CREATE INDEX "OrderPaymentVoucher_orderId_idx" ON "OrderPaymentVoucher"("orderId");

-- CreateIndex
CREATE INDEX "OrderPaymentVoucher_orderId_voucherType_idx" ON "OrderPaymentVoucher"("orderId", "voucherType");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickOrder" ADD CONSTRAINT "QuickOrder_batchTaskId_fkey" FOREIGN KEY ("batchTaskId") REFERENCES "BatchImportTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickOrder" ADD CONSTRAINT "QuickOrder_markUserId_fkey" FOREIGN KEY ("markUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickOrder" ADD CONSTRAINT "QuickOrder_recipientAddressId_fkey" FOREIGN KEY ("recipientAddressId") REFERENCES "OrderRecipientAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickOrder" ADD CONSTRAINT "QuickOrder_overseasAddressId_fkey" FOREIGN KEY ("overseasAddressId") REFERENCES "OrderOverseasAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickOrder" ADD CONSTRAINT "QuickOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRecipientAddress" ADD CONSTRAINT "OrderRecipientAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderOverseasAddress" ADD CONSTRAINT "OrderOverseasAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDeclaration" ADD CONSTRAINT "OrderDeclaration_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "QuickOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderContainer" ADD CONSTRAINT "OrderContainer_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "QuickOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchImportTask" ADD CONSTRAINT "BatchImportTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_quickOrderId_fkey" FOREIGN KEY ("quickOrderId") REFERENCES "QuickOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_quickOrderId_fkey" FOREIGN KEY ("quickOrderId") REFERENCES "QuickOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPaymentCollection" ADD CONSTRAINT "OrderPaymentCollection_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "QuickOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPaymentVoucher" ADD CONSTRAINT "OrderPaymentVoucher_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "QuickOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

