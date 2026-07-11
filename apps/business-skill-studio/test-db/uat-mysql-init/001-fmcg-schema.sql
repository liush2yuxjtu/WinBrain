CREATE DATABASE IF NOT EXISTS uat_dws CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE uat_dws;

CREATE TABLE dim_product (
  product_id BIGINT PRIMARY KEY,
  sku_code VARCHAR(64) NOT NULL UNIQUE,
  product_name VARCHAR(255) NOT NULL,
  brand_name VARCHAR(128) NOT NULL,
  category_l1 VARCHAR(128) NOT NULL,
  category_l2 VARCHAR(128),
  package_size VARCHAR(64),
  list_price DECIMAL(12,2),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE dim_store (
  store_id BIGINT PRIMARY KEY,
  store_code VARCHAR(64) NOT NULL UNIQUE,
  store_name VARCHAR(255) NOT NULL,
  channel_type VARCHAR(64) NOT NULL,
  region_name VARCHAR(128) NOT NULL,
  city_name VARCHAR(128),
  opened_date DATE,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE dim_customer (
  customer_id BIGINT PRIMARY KEY,
  customer_code VARCHAR(64) NOT NULL UNIQUE,
  customer_name VARCHAR(255) NOT NULL,
  customer_segment VARCHAR(64),
  region_name VARCHAR(128),
  account_owner VARCHAR(128),
  risk_level VARCHAR(32)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE fact_sales_daily (
  sales_date DATE NOT NULL,
  store_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  customer_id BIGINT,
  order_count INT NOT NULL DEFAULT 0,
  quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
  gross_sales DECIMAL(16,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(16,2) NOT NULL DEFAULT 0,
  net_sales DECIMAL(16,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (sales_date, store_id, product_id),
  KEY idx_sales_customer (customer_id),
  CONSTRAINT fk_sales_store FOREIGN KEY (store_id) REFERENCES dim_store(store_id),
  CONSTRAINT fk_sales_product FOREIGN KEY (product_id) REFERENCES dim_product(product_id),
  CONSTRAINT fk_sales_customer FOREIGN KEY (customer_id) REFERENCES dim_customer(customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE fact_inventory_snapshot (
  snapshot_date DATE NOT NULL,
  store_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  on_hand_quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
  in_transit_quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
  days_of_supply DECIMAL(10,2),
  out_of_stock_flag TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (snapshot_date, store_id, product_id),
  CONSTRAINT fk_inventory_store FOREIGN KEY (store_id) REFERENCES dim_store(store_id),
  CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES dim_product(product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE OR REPLACE VIEW vw_brand_sales_summary AS
SELECT
  s.sales_date,
  p.brand_name,
  p.category_l1,
  SUM(s.quantity) AS total_quantity,
  SUM(s.net_sales) AS total_net_sales
FROM fact_sales_daily s
JOIN dim_product p ON p.product_id = s.product_id
GROUP BY s.sales_date, p.brand_name, p.category_l1;

INSERT INTO dim_product (product_id, sku_code, product_name, brand_name, category_l1, category_l2, package_size, list_price) VALUES
  (1, 'SKU-COFFEE-001', '即饮拿铁咖啡', 'NorthBean', '饮料', '咖啡', '280ml', 12.90),
  (2, 'SKU-SNACK-001', '海盐薯片', 'CrispWay', '休闲食品', '膨化食品', '90g', 8.50),
  (3, 'SKU-CARE-001', '清爽洗发露', 'DailyCare', '个人护理', '洗护', '500ml', 39.00);

INSERT INTO dim_store (store_id, store_code, store_name, channel_type, region_name, city_name, opened_date) VALUES
  (101, 'BJ-HYPER-01', '北京北区大卖场', 'HYPERMARKET', '华北', '北京', '2020-01-15'),
  (102, 'SH-CVS-01', '上海便利店一号', 'CONVENIENCE', '华东', '上海', '2021-06-01');

INSERT INTO dim_customer (customer_id, customer_code, customer_name, customer_segment, region_name, account_owner, risk_level) VALUES
  (1001, 'CUST-001', '华北重点零售客户', 'KEY_ACCOUNT', '华北', '张敏', 'MEDIUM'),
  (1002, 'CUST-002', '华东便利渠道客户', 'DISTRIBUTOR', '华东', '李浩', 'LOW');

INSERT INTO fact_sales_daily (sales_date, store_id, product_id, customer_id, order_count, quantity, gross_sales, discount_amount, net_sales) VALUES
  ('2026-07-01', 101, 1, 1001, 18, 240, 3096.00, 156.00, 2940.00),
  ('2026-07-01', 101, 2, 1001, 11, 180, 1530.00, 90.00, 1440.00),
  ('2026-07-01', 102, 1, 1002, 9, 96, 1238.40, 46.40, 1192.00);

INSERT INTO fact_inventory_snapshot (snapshot_date, store_id, product_id, on_hand_quantity, in_transit_quantity, days_of_supply, out_of_stock_flag) VALUES
  ('2026-07-01', 101, 1, 520, 120, 8.40, 0),
  ('2026-07-01', 101, 2, 60, 0, 1.20, 0),
  ('2026-07-01', 102, 1, 0, 48, 0.00, 1);
