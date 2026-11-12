-- Composite spray recipe links + oil ratio
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "oilProductId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "waterProductId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "bottleProductId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "oilRatioPercent" DECIMAL(5,2) NOT NULL DEFAULT 50;

CREATE INDEX IF NOT EXISTS "Product_oilProductId_idx" ON "Product"("oilProductId");
CREATE INDEX IF NOT EXISTS "Product_waterProductId_idx" ON "Product"("waterProductId");
CREATE INDEX IF NOT EXISTS "Product_bottleProductId_idx" ON "Product"("bottleProductId");

DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_oilProductId_fkey"
    FOREIGN KEY ("oilProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_waterProductId_fkey"
    FOREIGN KEY ("waterProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_bottleProductId_fkey"
    FOREIGN KEY ("bottleProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
