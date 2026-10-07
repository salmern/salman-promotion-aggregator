/**
 * Migration runner.
 * Creates all tables if they don't exist.
 * Idempotent — safe to run on every startup.
 *
 * We use raw SQL with CREATE TABLE IF NOT EXISTS rather than drizzle-kit
 * migrations to avoid requiring the CLI in the Docker image at runtime.
 * The schema here must stay in sync with the Drizzle schema definitions.
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DDL = `
-- Brands table
CREATE TABLE IF NOT EXISTS brands (
  id               INT          NOT NULL AUTO_INCREMENT,
  source_brand_key VARCHAR(255) NOT NULL,
  name             VARCHAR(255) NOT NULL,
  website_url      VARCHAR(2048),
  hours            JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  hours_raw        TEXT,
  social_links     JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  source_url       VARCHAR(2048),
  scraped_at       DATETIME(3)  NOT NULL,
  created_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY brands_source_brand_key_idx (source_brand_key),
  KEY brands_name_idx (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Promotions table
CREATE TABLE IF NOT EXISTS promotions (
  id                  INT           NOT NULL AUTO_INCREMENT,
  source_id           VARCHAR(64)   NOT NULL,
  brand_id            INT           NOT NULL,
  name                VARCHAR(512)  NOT NULL,
  description         TEXT,
  image_url           VARCHAR(2048),
  start_date          DATETIME(3),
  end_date            DATETIME(3),
  canonical_url       VARCHAR(2048) NOT NULL,
  source_portal       VARCHAR(255)  NOT NULL,
  scraped_at          DATETIME(3)   NOT NULL,
  last_verified_at    DATETIME(3),
  verification_status ENUM('pending','verified','changed','gone','unverifiable') NOT NULL DEFAULT 'pending',
  created_at          DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY promotions_source_id_idx (source_id),
  KEY promotions_brand_id_idx (brand_id),
  KEY promotions_end_date_idx (end_date),
  KEY promotions_start_date_idx (start_date),
  KEY promotions_date_range_idx (start_date, end_date),
  CONSTRAINT fk_promotions_brand_id FOREIGN KEY (brand_id) REFERENCES brands (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verification runs table
CREATE TABLE IF NOT EXISTS verification_runs (
  id                INT         NOT NULL AUTO_INCREMENT,
  status            ENUM('running','completed','failed') NOT NULL DEFAULT 'running',
  started_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at      DATETIME(3),
  checked_count     INT         NOT NULL DEFAULT 0,
  discrepancy_count INT         NOT NULL DEFAULT 0,
  failed_count      INT         NOT NULL DEFAULT 0,
  error             TEXT,
  PRIMARY KEY (id),
  KEY verification_runs_status_idx (status),
  KEY verification_runs_started_at_idx (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Verification discrepancies table
CREATE TABLE IF NOT EXISTS verification_discrepancies (
  id                 INT          NOT NULL AUTO_INCREMENT,
  run_id             INT          NOT NULL,
  promotion_id       INT,
  brand_id           INT,
  promotion_name     VARCHAR(512),
  discrepancy_type   ENUM('gone','changed','unverifiable') NOT NULL,
  field_name         VARCHAR(128),
  before_value       TEXT,
  after_value        TEXT,
  reason             TEXT,
  created_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY verification_discrepancies_run_id_idx (run_id),
  KEY verification_discrepancies_promotion_id_idx (promotion_id),
  CONSTRAINT fk_vd_run_id FOREIGN KEY (run_id) REFERENCES verification_runs (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_vd_promotion_id FOREIGN KEY (promotion_id) REFERENCES promotions (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_vd_brand_id FOREIGN KEY (brand_id) REFERENCES brands (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

export async function runMigrations(databaseUrl?: string): Promise<void> {
  const url = databaseUrl ?? process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is not set');

  const connection = await mysql.createConnection({ uri: url, multipleStatements: true });
  try {
    console.log('[migrate] Running database migrations...');
    await connection.query(DDL);
    console.log('[migrate] Migrations complete.');
  } finally {
    await connection.end();
  }
}

// Allow running directly: ts-node src/migrate.ts
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error('[migrate] Migration failed:', err);
      process.exit(1);
    });
}
