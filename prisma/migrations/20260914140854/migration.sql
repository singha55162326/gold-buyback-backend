-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'PAYMENT', 'VALUER', 'FINANCIAL_CONTROLLER', 'WAREHOUSE');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('LAK', 'THB', 'USD');

-- CreateEnum
CREATE TYPE "GoldCategoryCode" AS ENUM ('JEWELRY', 'BAR');

-- CreateEnum
CREATE TYPE "DeductionKind" AS ENUM ('PERCENT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('OPEN', 'PENDING_APPROVAL', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CashRequestDirection" AS ENUM ('WITHDRAW', 'HANDOVER');

-- CreateEnum
CREATE TYPE "CashTxnType" AS ENUM ('IN', 'OUT', 'OTHER_INCOME', 'OTHER_EXPENSE');

-- CreateEnum
CREATE TYPE "BankTxnType" AS ENUM ('DEPOSIT', 'WITHDRAW', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK');

-- CreateEnum
CREATE TYPE "BuybackSource" AS ENUM ('KPV', 'OTHER_SHOP');

-- CreateEnum
CREATE TYPE "ExchangeTxnType" AS ENUM ('EXCHANGE_TO_CASH', 'FREE_EXCHANGE');

-- CreateEnum
CREATE TYPE "ShapeCondition" AS ENUM ('GOOD', 'DAMAGED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('ORDER_PLACED', 'SENT_TO_SMITH', 'RECEIVED_FROM_SMITH', 'AWAITING_PICKUP', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockScope" AS ENUM ('NEW', 'OLD');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "PartnerDirection" AS ENUM ('IN', 'OUT', 'BOTH');

-- CreateEnum
CREATE TYPE "TransformType" AS ENUM ('DYE', 'ETCH', 'MELT');

-- CreateEnum
CREATE TYPE "FactoryTrackStatus" AS ENUM ('AWAITING_ASSESSMENT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ApArSide" AS ENUM ('AP', 'AR');

-- CreateEnum
CREATE TYPE "ApArRefType" AS ENUM ('ORDER_DEPOSIT', 'ORDER_SETTLEMENT', 'LABOR_PAYABLE', 'LABOR_PAYMENT', 'CREDIT_ISSUED', 'CREDIT_RECEIPT', 'STOCK_IN', 'STOCK_OUT', 'FACTORY_ASSESSED', 'OPENING', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "OrderProductType" AS ENUM ('IT', 'ITP');

-- CreateEnum
CREATE TYPE "IncomeExpenseKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "ConsignmentStatus" AS ENUM ('HELD', 'RETURNED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'COMPLETE', 'LOGIN', 'LOGOUT');

-- CreateEnum
CREATE TYPE "WhatsAppStatus" AS ENUM ('SKIPPED', 'PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('BUYBACK_CREATED', 'EXCHANGE_CREATED', 'CREDIT_CREATED', 'APPROVAL_RESULT', 'CASH_REQUEST', 'SHIFT_CLOSE', 'GOLD_HANDOVER', 'STOCK_OUT_APPROVAL', 'LABOR_FEE_PAYMENT', 'FACTORY_ASSESSMENT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "phone" TEXT,
    "whatsappNumber" TEXT,
    "notifyWhatsApp" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "summary" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "recipientUserId" TEXT,
    "recipientRole" "UserRole",
    "title" TEXT NOT NULL,
    "body" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "whatsappStatus" "WhatsAppStatus" NOT NULL DEFAULT 'SKIPPED',
    "whatsappSentAt" TIMESTAMP(3),
    "whatsappAttempts" INTEGER NOT NULL DEFAULT 0,
    "whatsappError" TEXT,
    "whatsappTo" TEXT,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weight_tiers" (
    "code" TEXT NOT NULL,
    "category" "GoldCategoryCode" NOT NULL,
    "labelLo" TEXT NOT NULL,
    "displayWeightG" DECIMAL(18,4) NOT NULL,
    "exchangeWeightG" DECIMAL(18,4) NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "weight_tiers_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "price_snapshots" (
    "id" TEXT NOT NULL,
    "price1Baht" DECIMAL(18,4) NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_snapshot_lines" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "tierCode" TEXT NOT NULL,
    "sellPrice" DECIMAL(18,4) NOT NULL,
    "buybackPrice" DECIMAL(18,4) NOT NULL,
    "steps" JSONB,

    CONSTRAINT "price_snapshot_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyback_deduction_rules" (
    "id" TEXT NOT NULL,
    "tierCode" TEXT NOT NULL,
    "kind" "DeductionKind" NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buyback_deduction_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rate_snapshots" (
    "id" TEXT NOT NULL,
    "thbSellRate" DECIMAL(18,4) NOT NULL,
    "usdSellRate" DECIMAL(18,4) NOT NULL,
    "thbBuybackRate" DECIMAL(18,4) NOT NULL,
    "usdBuybackRate" DECIMAL(18,4) NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rate_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jewelry_conversion_fees" (
    "id" TEXT NOT NULL,
    "tierCode" TEXT NOT NULL,
    "weightG" DECIMAL(18,4) NOT NULL,
    "feeGoodShape" DECIMAL(18,4) NOT NULL,
    "feeDamagedShape" DECIMAL(18,4) NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jewelry_conversion_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bar_conversion_fees" (
    "id" TEXT NOT NULL,
    "weightG" DECIMAL(18,4) NOT NULL,
    "barToJewelry" DECIMAL(18,4) NOT NULL,
    "barToBar" DECIMAL(18,4) NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bar_conversion_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soft_gold_fee_snapshots" (
    "id" TEXT NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "soft_gold_fee_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gold_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameLo" TEXT NOT NULL,
    "isStockType" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "gold_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gold_items" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameLo" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "gold_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gold_skus" (
    "id" TEXT NOT NULL,
    "goldItemId" TEXT NOT NULL,
    "nameLo" TEXT NOT NULL,
    "weightG" DECIMAL(18,4) NOT NULL,
    "bahtWeight" DECIMAL(18,4) NOT NULL,
    "fullSkuName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "gold_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cabinets" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameLo" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "cabinets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_sources" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameLo" TEXT NOT NULL,
    "direction" "PartnerDirection" NOT NULL,
    "tracksGoldApAr" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "partner_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameLo" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_days" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessDayId" TEXT NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "note" TEXT,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_cash_balances" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "shift_cash_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_transactions" (
    "id" TEXT NOT NULL,
    "businessDayId" TEXT NOT NULL,
    "shiftId" TEXT,
    "type" "CashTxnType" NOT NULL,
    "currency" "Currency" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "cash_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" TEXT NOT NULL,
    "businessDayId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "type" "BankTxnType" NOT NULL,
    "currency" "Currency" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_net_balances" (
    "id" TEXT NOT NULL,
    "businessDayId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "netAmount" DECIMAL(18,4) NOT NULL,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_net_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_requests" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "direction" "CashRequestDirection" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "cash_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_request_lines" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "cash_request_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "nameLo" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buybacks" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "source" "BuybackSource" NOT NULL,
    "goldTypeId" TEXT NOT NULL,
    "goldItemId" TEXT,
    "weightG" DECIMAL(18,4) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "goldPercent" DECIMAL(18,4),
    "shopBuybackPrice" DECIMAL(18,4) NOT NULL,
    "deduction" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "payableAmount" DECIMAL(18,4) NOT NULL,
    "paidAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "outstandingAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "buybacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyback_payments" (
    "id" TEXT NOT NULL,
    "buybackId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "bankAccountId" TEXT,
    "currency" "Currency" NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "amountLak" DECIMAL(18,4) NOT NULL,
    "changeLak" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buyback_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gold_exchanges" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "txnType" "ExchangeTxnType" NOT NULL,
    "shapeCondition" "ShapeCondition" NOT NULL,
    "softGoldFee" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalPayable" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "outstandingAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "gold_exchanges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_old_lines" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "goldTypeId" TEXT NOT NULL,
    "goldItemId" TEXT,
    "weightG" DECIMAL(18,4) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "standardWeightG" DECIMAL(18,4) NOT NULL,
    "shopBuybackPrice" DECIMAL(18,4) NOT NULL DEFAULT 0,

    CONSTRAINT "exchange_old_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_new_lines" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "goldSkuId" TEXT NOT NULL,
    "cabinetId" TEXT,
    "weightG" DECIMAL(18,4) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "humpFee" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "barConvertFee" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "patternFee" DECIMAL(18,4) NOT NULL DEFAULT 0,

    CONSTRAINT "exchange_new_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_remaining_lines" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "weightG" DECIMAL(18,4) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "shopBuybackPrice" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "exchange_remaining_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gold_credits" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "goldItemId" TEXT NOT NULL,
    "cabinetId" TEXT,
    "weightG" DECIMAL(18,4) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sellPrice" DECIMAL(18,4) NOT NULL,
    "downPayment" DECIMAL(18,4) NOT NULL,
    "outstanding" DECIMAL(18,4) NOT NULL,
    "paidAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "gold_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_receipts" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "bankAccountId" TEXT,
    "currency" "Currency" NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "amountLak" DECIMAL(18,4) NOT NULL,
    "changeLak" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "isDownPayment" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "billNo" TEXT NOT NULL,
    "productType" "OrderProductType" NOT NULL,
    "staffName" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "goldItemId" TEXT NOT NULL,
    "supplierId" TEXT,
    "receivedFromSmithAt" TIMESTAMP(3),
    "customerPickupAt" TIMESTAMP(3),
    "weightG" DECIMAL(18,4) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "totalAmount" DECIMAL(18,4) NOT NULL,
    "receivedAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "balanceAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'ORDER_PLACED',
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_receipts" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "bankAccountId" TEXT,
    "currency" "Currency" NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "amountLak" DECIMAL(18,4) NOT NULL,
    "changeLak" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "isRefund" BOOLEAN NOT NULL DEFAULT false,
    "isDeposit" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "note" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "scope" "StockScope" NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "partnerId" TEXT,
    "cabinetId" TEXT,
    "transformType" "TransformType",
    "goldPercent" DECIMAL(18,4),
    "expectedReturnG" DECIMAL(18,4),
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "totalGoldG" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "pricePerG" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "pricePerBaht" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "laborFeeThb" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "laborFeePaid" BOOLEAN NOT NULL DEFAULT false,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movement_lines" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "goldSkuId" TEXT,
    "goldTypeId" TEXT,
    "weightG" DECIMAL(18,4) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "goldG" DECIMAL(18,4) NOT NULL,
    "cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "isCounterpart" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "stock_movement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_new_ledger" (
    "id" TEXT NOT NULL,
    "movementId" TEXT,
    "businessDate" DATE NOT NULL,
    "partnerLabel" TEXT,
    "typeLabel" TEXT NOT NULL,
    "goldInG" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "goldOutG" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "weightG" DECIMAL(18,4) NOT NULL,
    "priceIn" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "priceOut" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "cost" DECIMAL(18,4) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "stock_new_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_new_sku_balances" (
    "id" TEXT NOT NULL,
    "businessDayId" TEXT NOT NULL,
    "goldSkuId" TEXT NOT NULL,
    "openingQty" INTEGER NOT NULL DEFAULT 0,
    "inQty" INTEGER NOT NULL DEFAULT 0,
    "outQty" INTEGER NOT NULL DEFAULT 0,
    "balanceQty" INTEGER NOT NULL DEFAULT 0,
    "totalWeightG" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_new_sku_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_old_ledger" (
    "id" TEXT NOT NULL,
    "movementId" TEXT,
    "goldTypeId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "partnerLabel" TEXT,
    "typeLabel" TEXT NOT NULL,
    "goldInG" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "goldOutG" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "weightG" DECIMAL(18,4) NOT NULL,
    "priceIn" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "priceOut" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "cost" DECIMAL(18,4) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "stock_old_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_old_type_balances" (
    "id" TEXT NOT NULL,
    "businessDayId" TEXT NOT NULL,
    "goldTypeId" TEXT NOT NULL,
    "openingWeightG" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "openingCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "inG" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "outG" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "priceIn" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "priceOut" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "closingWeightG" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "closingCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_old_type_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gold_handovers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "goldTypeId" TEXT NOT NULL,
    "weightG" DECIMAL(18,4) NOT NULL,
    "note" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "gold_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factory_out_tracking" (
    "id" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "goldOutG" DECIMAL(18,4) NOT NULL,
    "factoryAssessedG" DECIMAL(18,4),
    "cost" DECIMAL(18,4) NOT NULL,
    "status" "FactoryTrackStatus" NOT NULL DEFAULT 'AWAITING_ASSESSMENT',
    "completedAt" TIMESTAMP(3),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "factory_out_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gold_ap_ar_posting_rules" (
    "id" TEXT NOT NULL,
    "scope" "StockScope" NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "partnerId" TEXT NOT NULL,
    "side" "ApArSide" NOT NULL,
    "sign" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gold_ap_ar_posting_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gold_ap_ar_ledger" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "side" "ApArSide" NOT NULL,
    "refType" "ApArRefType" NOT NULL,
    "movementId" TEXT,
    "businessDate" DATE NOT NULL,
    "typeLabel" TEXT NOT NULL,
    "goldInG" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "goldOutG" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "weightG" DECIMAL(18,4) NOT NULL,
    "priceIn" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "priceOut" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "cost" DECIMAL(18,4) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "gold_ap_ar_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gold_ap_ar_openings" (
    "id" TEXT NOT NULL,
    "businessDayId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "side" "ApArSide" NOT NULL,
    "openingWeightG" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "openingCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "movementG" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "closingWeightG" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "closingCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gold_ap_ar_openings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_ap_ar_ledger" (
    "id" TEXT NOT NULL,
    "side" "ApArSide" NOT NULL,
    "refType" "ApArRefType" NOT NULL,
    "refId" TEXT,
    "partnerId" TEXT,
    "categoryId" TEXT,
    "businessDate" DATE NOT NULL,
    "currency" "Currency" NOT NULL,
    "amountIn" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "amountOut" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "balance" DECIMAL(18,4) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "cash_ap_ar_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_ap_ar_openings" (
    "id" TEXT NOT NULL,
    "businessDayId" TEXT NOT NULL,
    "side" "ApArSide" NOT NULL,
    "currency" "Currency" NOT NULL,
    "openingAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "increaseAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "decreaseAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "closingAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_ap_ar_openings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wac_snapshots" (
    "id" TEXT NOT NULL,
    "businessDayId" TEXT NOT NULL,
    "newWeightG" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "newCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "oldWeightG" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "oldCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalWeightG" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "pricePerG" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "pricePerBaht" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wac_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_expense_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameLo" TEXT NOT NULL,
    "kind" "IncomeExpenseKind" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "income_expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_expense_transactions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "businessDayId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "kind" "IncomeExpenseKind" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "bankAccountId" TEXT,
    "currency" "Currency" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "income_expense_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consignments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "totalWeightG" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" "ConsignmentStatus" NOT NULL DEFAULT 'HELD',
    "returnedAt" TIMESTAMP(3),
    "returnedById" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "consignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consignment_lines" (
    "id" TEXT NOT NULL,
    "consignmentId" TEXT NOT NULL,
    "nameLo" TEXT NOT NULL,
    "weightG" DECIMAL(18,4) NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "consignment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_ledger" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "currency" "Currency" NOT NULL,
    "amountIn" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "amountOut" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "balance" DECIMAL(18,4) NOT NULL,
    "method" "PaymentMethod",
    "bankAccountId" TEXT,
    "sequence" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "advance_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ap_ar_cash_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameLo" TEXT NOT NULL,
    "side" "ApArSide",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ap_ar_cash_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_payments" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "bankAccountId" TEXT,
    "currency" "Currency" NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "amountLak" DECIMAL(18,4) NOT NULL,
    "changeLak" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_role_isActive_idx" ON "users"("role", "isActive");

-- CreateIndex
CREATE INDEX "sessions_userId_expiresAt_idx" ON "sessions"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_recipientUserId_readAt_idx" ON "notifications"("recipientUserId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_recipientRole_readAt_idx" ON "notifications"("recipientRole", "readAt");

-- CreateIndex
CREATE INDEX "notifications_whatsappStatus_createdAt_idx" ON "notifications"("whatsappStatus", "createdAt");

-- CreateIndex
CREATE INDEX "weight_tiers_category_sortOrder_idx" ON "weight_tiers"("category", "sortOrder");

-- CreateIndex
CREATE INDEX "price_snapshots_effectiveAt_idx" ON "price_snapshots"("effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "price_snapshot_lines_snapshotId_tierCode_key" ON "price_snapshot_lines"("snapshotId", "tierCode");

-- CreateIndex
CREATE INDEX "buyback_deduction_rules_tierCode_effectiveAt_idx" ON "buyback_deduction_rules"("tierCode", "effectiveAt");

-- CreateIndex
CREATE INDEX "exchange_rate_snapshots_effectiveAt_idx" ON "exchange_rate_snapshots"("effectiveAt");

-- CreateIndex
CREATE INDEX "jewelry_conversion_fees_tierCode_effectiveAt_idx" ON "jewelry_conversion_fees"("tierCode", "effectiveAt");

-- CreateIndex
CREATE INDEX "bar_conversion_fees_weightG_effectiveAt_idx" ON "bar_conversion_fees"("weightG", "effectiveAt");

-- CreateIndex
CREATE INDEX "soft_gold_fee_snapshots_effectiveAt_idx" ON "soft_gold_fee_snapshots"("effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "gold_types_code_key" ON "gold_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "gold_items_code_key" ON "gold_items"("code");

-- CreateIndex
CREATE INDEX "gold_skus_fullSkuName_idx" ON "gold_skus"("fullSkuName");

-- CreateIndex
CREATE UNIQUE INDEX "gold_skus_goldItemId_weightG_key" ON "gold_skus"("goldItemId", "weightG");

-- CreateIndex
CREATE UNIQUE INDEX "cabinets_code_key" ON "cabinets"("code");

-- CreateIndex
CREATE UNIQUE INDEX "partner_sources_code_key" ON "partner_sources"("code");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_code_key" ON "bank_accounts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "business_days_date_key" ON "business_days"("date");

-- CreateIndex
CREATE INDEX "business_days_date_idx" ON "business_days"("date");

-- CreateIndex
CREATE INDEX "shifts_status_idx" ON "shifts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_userId_businessDayId_key" ON "shifts"("userId", "businessDayId");

-- CreateIndex
CREATE UNIQUE INDEX "shift_cash_balances_shiftId_currency_key" ON "shift_cash_balances"("shiftId", "currency");

-- CreateIndex
CREATE INDEX "cash_transactions_businessDayId_currency_idx" ON "cash_transactions"("businessDayId", "currency");

-- CreateIndex
CREATE INDEX "cash_transactions_refType_refId_idx" ON "cash_transactions"("refType", "refId");

-- CreateIndex
CREATE INDEX "bank_transactions_businessDayId_bankAccountId_idx" ON "bank_transactions"("businessDayId", "bankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_net_balances_businessDayId_bankAccountId_currency_key" ON "bank_net_balances"("businessDayId", "bankAccountId", "currency");

-- CreateIndex
CREATE INDEX "cash_requests_status_idx" ON "cash_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "cash_request_lines_requestId_currency_key" ON "cash_request_lines"("requestId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "buybacks_code_key" ON "buybacks"("code");

-- CreateIndex
CREATE INDEX "buybacks_status_createdAt_idx" ON "buybacks"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "gold_exchanges_code_key" ON "gold_exchanges"("code");

-- CreateIndex
CREATE INDEX "gold_exchanges_status_createdAt_idx" ON "gold_exchanges"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "gold_credits_code_key" ON "gold_credits"("code");

-- CreateIndex
CREATE INDEX "gold_credits_status_createdAt_idx" ON "gold_credits"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "orders_code_key" ON "orders"("code");

-- CreateIndex
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "orders_billNo_idx" ON "orders"("billNo");

-- CreateIndex
CREATE INDEX "order_status_history_orderId_createdAt_idx" ON "order_status_history"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_code_key" ON "stock_movements"("code");

-- CreateIndex
CREATE INDEX "stock_movements_scope_type_status_idx" ON "stock_movements"("scope", "type", "status");

-- CreateIndex
CREATE INDEX "stock_movement_lines_movementId_idx" ON "stock_movement_lines"("movementId");

-- CreateIndex
CREATE INDEX "stock_new_ledger_createdAt_idx" ON "stock_new_ledger"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "stock_new_ledger_businessDate_sequence_key" ON "stock_new_ledger"("businessDate", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "stock_new_sku_balances_businessDayId_goldSkuId_key" ON "stock_new_sku_balances"("businessDayId", "goldSkuId");

-- CreateIndex
CREATE INDEX "stock_old_ledger_goldTypeId_createdAt_idx" ON "stock_old_ledger"("goldTypeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "stock_old_ledger_businessDate_sequence_key" ON "stock_old_ledger"("businessDate", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "stock_old_type_balances_businessDayId_goldTypeId_key" ON "stock_old_type_balances"("businessDayId", "goldTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "gold_handovers_code_key" ON "gold_handovers"("code");

-- CreateIndex
CREATE INDEX "gold_handovers_status_idx" ON "gold_handovers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "factory_out_tracking_movementId_key" ON "factory_out_tracking"("movementId");

-- CreateIndex
CREATE INDEX "factory_out_tracking_status_idx" ON "factory_out_tracking"("status");

-- CreateIndex
CREATE UNIQUE INDEX "gold_ap_ar_posting_rules_scope_type_partnerId_key" ON "gold_ap_ar_posting_rules"("scope", "type", "partnerId");

-- CreateIndex
CREATE INDEX "gold_ap_ar_ledger_side_businessDate_idx" ON "gold_ap_ar_ledger"("side", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "gold_ap_ar_ledger_partnerId_side_businessDate_sequence_key" ON "gold_ap_ar_ledger"("partnerId", "side", "businessDate", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "gold_ap_ar_openings_businessDayId_partnerId_side_key" ON "gold_ap_ar_openings"("businessDayId", "partnerId", "side");

-- CreateIndex
CREATE INDEX "cash_ap_ar_ledger_refType_refId_idx" ON "cash_ap_ar_ledger"("refType", "refId");

-- CreateIndex
CREATE INDEX "cash_ap_ar_ledger_partnerId_side_idx" ON "cash_ap_ar_ledger"("partnerId", "side");

-- CreateIndex
CREATE UNIQUE INDEX "cash_ap_ar_ledger_side_currency_businessDate_sequence_key" ON "cash_ap_ar_ledger"("side", "currency", "businessDate", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "cash_ap_ar_openings_businessDayId_side_currency_key" ON "cash_ap_ar_openings"("businessDayId", "side", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "wac_snapshots_businessDayId_key" ON "wac_snapshots"("businessDayId");

-- CreateIndex
CREATE UNIQUE INDEX "income_expense_categories_code_key" ON "income_expense_categories"("code");

-- CreateIndex
CREATE INDEX "income_expense_categories_kind_sortOrder_idx" ON "income_expense_categories"("kind", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "income_expense_transactions_code_key" ON "income_expense_transactions"("code");

-- CreateIndex
CREATE INDEX "income_expense_transactions_businessDayId_kind_idx" ON "income_expense_transactions"("businessDayId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "consignments_code_key" ON "consignments"("code");

-- CreateIndex
CREATE INDEX "consignments_status_createdAt_idx" ON "consignments"("status", "createdAt");

-- CreateIndex
CREATE INDEX "consignments_billId_idx" ON "consignments"("billId");

-- CreateIndex
CREATE INDEX "consignment_lines_consignmentId_idx" ON "consignment_lines"("consignmentId");

-- CreateIndex
CREATE INDEX "advance_ledger_orderId_idx" ON "advance_ledger"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "advance_ledger_currency_businessDate_sequence_key" ON "advance_ledger"("currency", "businessDate", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "ap_ar_cash_categories_code_key" ON "ap_ar_cash_categories"("code");

-- CreateIndex
CREATE INDEX "exchange_payments_exchangeId_idx" ON "exchange_payments"("exchangeId");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_snapshot_lines" ADD CONSTRAINT "price_snapshot_lines_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "price_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_snapshot_lines" ADD CONSTRAINT "price_snapshot_lines_tierCode_fkey" FOREIGN KEY ("tierCode") REFERENCES "weight_tiers"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyback_deduction_rules" ADD CONSTRAINT "buyback_deduction_rules_tierCode_fkey" FOREIGN KEY ("tierCode") REFERENCES "weight_tiers"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jewelry_conversion_fees" ADD CONSTRAINT "jewelry_conversion_fees_tierCode_fkey" FOREIGN KEY ("tierCode") REFERENCES "weight_tiers"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_skus" ADD CONSTRAINT "gold_skus_goldItemId_fkey" FOREIGN KEY ("goldItemId") REFERENCES "gold_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_businessDayId_fkey" FOREIGN KEY ("businessDayId") REFERENCES "business_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_cash_balances" ADD CONSTRAINT "shift_cash_balances_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_businessDayId_fkey" FOREIGN KEY ("businessDayId") REFERENCES "business_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_businessDayId_fkey" FOREIGN KEY ("businessDayId") REFERENCES "business_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_net_balances" ADD CONSTRAINT "bank_net_balances_businessDayId_fkey" FOREIGN KEY ("businessDayId") REFERENCES "business_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_net_balances" ADD CONSTRAINT "bank_net_balances_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_requests" ADD CONSTRAINT "cash_requests_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_request_lines" ADD CONSTRAINT "cash_request_lines_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "cash_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buybacks" ADD CONSTRAINT "buybacks_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buybacks" ADD CONSTRAINT "buybacks_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buybacks" ADD CONSTRAINT "buybacks_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "price_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buybacks" ADD CONSTRAINT "buybacks_goldTypeId_fkey" FOREIGN KEY ("goldTypeId") REFERENCES "gold_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buybacks" ADD CONSTRAINT "buybacks_goldItemId_fkey" FOREIGN KEY ("goldItemId") REFERENCES "gold_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyback_payments" ADD CONSTRAINT "buyback_payments_buybackId_fkey" FOREIGN KEY ("buybackId") REFERENCES "buybacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyback_payments" ADD CONSTRAINT "buyback_payments_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_exchanges" ADD CONSTRAINT "gold_exchanges_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_exchanges" ADD CONSTRAINT "gold_exchanges_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_exchanges" ADD CONSTRAINT "gold_exchanges_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "price_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_old_lines" ADD CONSTRAINT "exchange_old_lines_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "gold_exchanges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_old_lines" ADD CONSTRAINT "exchange_old_lines_goldTypeId_fkey" FOREIGN KEY ("goldTypeId") REFERENCES "gold_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_old_lines" ADD CONSTRAINT "exchange_old_lines_goldItemId_fkey" FOREIGN KEY ("goldItemId") REFERENCES "gold_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_new_lines" ADD CONSTRAINT "exchange_new_lines_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "gold_exchanges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_new_lines" ADD CONSTRAINT "exchange_new_lines_goldSkuId_fkey" FOREIGN KEY ("goldSkuId") REFERENCES "gold_skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_new_lines" ADD CONSTRAINT "exchange_new_lines_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_remaining_lines" ADD CONSTRAINT "exchange_remaining_lines_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "gold_exchanges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_credits" ADD CONSTRAINT "gold_credits_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_credits" ADD CONSTRAINT "gold_credits_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_credits" ADD CONSTRAINT "gold_credits_goldItemId_fkey" FOREIGN KEY ("goldItemId") REFERENCES "gold_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_credits" ADD CONSTRAINT "gold_credits_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_receipts" ADD CONSTRAINT "credit_receipts_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "gold_credits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_receipts" ADD CONSTRAINT "credit_receipts_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_goldItemId_fkey" FOREIGN KEY ("goldItemId") REFERENCES "gold_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "partner_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_receipts" ADD CONSTRAINT "order_receipts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_receipts" ADD CONSTRAINT "order_receipts_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partner_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "stock_movement_lines_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "stock_movements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "stock_movement_lines_goldSkuId_fkey" FOREIGN KEY ("goldSkuId") REFERENCES "gold_skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "stock_movement_lines_goldTypeId_fkey" FOREIGN KEY ("goldTypeId") REFERENCES "gold_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_new_ledger" ADD CONSTRAINT "stock_new_ledger_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "stock_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_new_sku_balances" ADD CONSTRAINT "stock_new_sku_balances_businessDayId_fkey" FOREIGN KEY ("businessDayId") REFERENCES "business_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_new_sku_balances" ADD CONSTRAINT "stock_new_sku_balances_goldSkuId_fkey" FOREIGN KEY ("goldSkuId") REFERENCES "gold_skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_old_ledger" ADD CONSTRAINT "stock_old_ledger_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "stock_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_old_ledger" ADD CONSTRAINT "stock_old_ledger_goldTypeId_fkey" FOREIGN KEY ("goldTypeId") REFERENCES "gold_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_old_type_balances" ADD CONSTRAINT "stock_old_type_balances_businessDayId_fkey" FOREIGN KEY ("businessDayId") REFERENCES "business_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_old_type_balances" ADD CONSTRAINT "stock_old_type_balances_goldTypeId_fkey" FOREIGN KEY ("goldTypeId") REFERENCES "gold_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_handovers" ADD CONSTRAINT "gold_handovers_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_handovers" ADD CONSTRAINT "gold_handovers_goldTypeId_fkey" FOREIGN KEY ("goldTypeId") REFERENCES "gold_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factory_out_tracking" ADD CONSTRAINT "factory_out_tracking_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "stock_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factory_out_tracking" ADD CONSTRAINT "factory_out_tracking_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partner_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_ap_ar_posting_rules" ADD CONSTRAINT "gold_ap_ar_posting_rules_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partner_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_ap_ar_ledger" ADD CONSTRAINT "gold_ap_ar_ledger_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partner_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_ap_ar_ledger" ADD CONSTRAINT "gold_ap_ar_ledger_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "stock_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_ap_ar_openings" ADD CONSTRAINT "gold_ap_ar_openings_businessDayId_fkey" FOREIGN KEY ("businessDayId") REFERENCES "business_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_ap_ar_openings" ADD CONSTRAINT "gold_ap_ar_openings_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partner_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_ap_ar_ledger" ADD CONSTRAINT "cash_ap_ar_ledger_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partner_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_ap_ar_ledger" ADD CONSTRAINT "cash_ap_ar_ledger_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ap_ar_cash_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_ap_ar_openings" ADD CONSTRAINT "cash_ap_ar_openings_businessDayId_fkey" FOREIGN KEY ("businessDayId") REFERENCES "business_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wac_snapshots" ADD CONSTRAINT "wac_snapshots_businessDayId_fkey" FOREIGN KEY ("businessDayId") REFERENCES "business_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_expense_transactions" ADD CONSTRAINT "income_expense_transactions_businessDayId_fkey" FOREIGN KEY ("businessDayId") REFERENCES "business_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_expense_transactions" ADD CONSTRAINT "income_expense_transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "income_expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_expense_transactions" ADD CONSTRAINT "income_expense_transactions_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consignments" ADD CONSTRAINT "consignments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consignment_lines" ADD CONSTRAINT "consignment_lines_consignmentId_fkey" FOREIGN KEY ("consignmentId") REFERENCES "consignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_ledger" ADD CONSTRAINT "advance_ledger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_ledger" ADD CONSTRAINT "advance_ledger_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_payments" ADD CONSTRAINT "exchange_payments_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "gold_exchanges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_payments" ADD CONSTRAINT "exchange_payments_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
