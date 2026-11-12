-- Shared stock group for mirrored Attar / Oud / Spray oils
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stockGroupId" TEXT;
CREATE INDEX IF NOT EXISTS "Product_stockGroupId_idx" ON "Product"("stockGroupId");
