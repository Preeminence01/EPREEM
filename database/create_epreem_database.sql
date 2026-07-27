CREATE DATABASE IF NOT EXISTS `epreem`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `epreem`;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `category_commissions`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `reviews`;
DROP TABLE IF EXISTS `messages`;
DROP TABLE IF EXISTS `conversations`;
DROP TABLE IF EXISTS `disputes`;
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `coupons`;
DROP TABLE IF EXISTS `wishlists`;
DROP TABLE IF EXISTS `cart_items`;
DROP TABLE IF EXISTS `auction_watchers`;
DROP TABLE IF EXISTS `bids`;
DROP TABLE IF EXISTS `auctions`;
DROP TABLE IF EXISTS `product_images`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `business_staff`;
DROP TABLE IF EXISTS `businesses`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `password_reset_tokens`;
DROP TABLE IF EXISTS `users`;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(255) NULL,
  `email_verified_at` TIMESTAMP NULL,
  `password` VARCHAR(255) NOT NULL,
  `avatar_url` VARCHAR(255) NULL,
  `address` VARCHAR(255) NULL,
  `city` VARCHAR(255) NULL,
  `region` VARCHAR(255) NULL,
  `role` ENUM('buyer', 'seller', 'admin', 'super_admin', 'support_agent') NOT NULL DEFAULT 'buyer',
  `reason_for_joining` ENUM('buyer', 'seller', 'both') NOT NULL DEFAULT 'buyer',
  `verification_status` ENUM('unverified', 'pending', 'verified', 'rejected') NOT NULL DEFAULT 'unverified',
  `is_suspended` TINYINT(1) NOT NULL DEFAULT 0,
  `remember_token` VARCHAR(100) NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `password_reset_tokens` (
  `email` VARCHAR(255) NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `categories` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `icon` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `categories_slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `businesses` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `owner_id` BIGINT UNSIGNED NOT NULL,
  `company_name` VARCHAR(255) NOT NULL,
  `registration_number` VARCHAR(255) NULL,
  `industry` VARCHAR(255) NULL,
  `description` TEXT NULL,
  `logo_url` VARCHAR(255) NULL,
  `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `businesses_owner_id_foreign` (`owner_id`),
  CONSTRAINT `businesses_owner_id_foreign` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `business_staff` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `business_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `role` ENUM('manager', 'staff') NOT NULL DEFAULT 'staff',
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `business_staff_business_id_foreign` (`business_id`),
  KEY `business_staff_user_id_foreign` (`user_id`),
  CONSTRAINT `business_staff_business_id_foreign` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `business_staff_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `products` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `seller_id` BIGINT UNSIGNED NOT NULL,
  `business_id` BIGINT UNSIGNED NULL,
  `category_id` BIGINT UNSIGNED NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `price` DECIMAL(14,2) NOT NULL,
  `old_price` DECIMAL(14,2) NULL,
  `listing_type` ENUM('fixed', 'auction', 'rent') NOT NULL DEFAULT 'fixed',
  `condition` VARCHAR(255) NULL,
  `location` VARCHAR(255) NULL,
  `warranty` TINYINT(1) NOT NULL DEFAULT 0,
  `stock` INT UNSIGNED NOT NULL DEFAULT 1,
  `status` ENUM('draft', 'pending_review', 'live', 'sold', 'suspended') NOT NULL DEFAULT 'pending_review',
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `products_category_id_status_index` (`category_id`, `status`),
  KEY `products_seller_id_foreign` (`seller_id`),
  KEY `products_business_id_foreign` (`business_id`),
  CONSTRAINT `products_business_id_foreign` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`) ON DELETE SET NULL,
  CONSTRAINT `products_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `products_seller_id_foreign` FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `product_images` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `url` VARCHAR(255) NOT NULL,
  `type` ENUM('image', 'video') NOT NULL DEFAULT 'image',
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `product_images_product_id_foreign` (`product_id`),
  CONSTRAINT `product_images_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `auctions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `starting_price` DECIMAL(14,2) NOT NULL,
  `current_bid` DECIMAL(14,2) NULL,
  `min_increment` DECIMAL(14,2) NOT NULL DEFAULT 50.00,
  `current_bidder_id` BIGINT UNSIGNED NULL,
  `starts_at` TIMESTAMP NOT NULL,
  `ends_at` TIMESTAMP NOT NULL,
  `status` ENUM('scheduled', 'live', 'closed', 'cancelled') NOT NULL DEFAULT 'scheduled',
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `auctions_product_id_foreign` (`product_id`),
  KEY `auctions_current_bidder_id_foreign` (`current_bidder_id`),
  CONSTRAINT `auctions_current_bidder_id_foreign` FOREIGN KEY (`current_bidder_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `auctions_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `bids` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `auction_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `amount` DECIMAL(14,2) NOT NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `bids_auction_id_foreign` (`auction_id`),
  KEY `bids_user_id_foreign` (`user_id`),
  CONSTRAINT `bids_auction_id_foreign` FOREIGN KEY (`auction_id`) REFERENCES `auctions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `bids_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `auction_watchers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `auction_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auction_watchers_auction_id_user_id_unique` (`auction_id`, `user_id`),
  KEY `auction_watchers_user_id_foreign` (`user_id`),
  CONSTRAINT `auction_watchers_auction_id_foreign` FOREIGN KEY (`auction_id`) REFERENCES `auctions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `auction_watchers_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cart_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cart_items_user_id_product_id_unique` (`user_id`, `product_id`),
  KEY `cart_items_product_id_foreign` (`product_id`),
  CONSTRAINT `cart_items_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cart_items_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `wishlists` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `wishlists_user_id_product_id_unique` (`user_id`, `product_id`),
  KEY `wishlists_product_id_foreign` (`product_id`),
  CONSTRAINT `wishlists_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `wishlists_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `coupons` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(255) NOT NULL,
  `type` ENUM('fixed', 'percent') NOT NULL DEFAULT 'fixed',
  `value` DECIMAL(10,2) NOT NULL,
  `expires_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `coupons_code_unique` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_number` VARCHAR(255) NOT NULL,
  `buyer_id` BIGINT UNSIGNED NOT NULL,
  `subtotal` DECIMAL(14,2) NOT NULL,
  `shipping_fee` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `discount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(14,2) NOT NULL,
  `payment_method` ENUM('card', 'mobile_money', 'bank_transfer', 'wallet') NOT NULL,
  `payment_status` ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL DEFAULT 'pending',
  `fulfillment_status` ENUM('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'disputed') NOT NULL DEFAULT 'pending',
  `shipping_name` VARCHAR(255) NULL,
  `shipping_phone` VARCHAR(255) NULL,
  `shipping_address` VARCHAR(255) NULL,
  `shipping_city` VARCHAR(255) NULL,
  `shipping_region` VARCHAR(255) NULL,
  `delivery_notes` TEXT NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `orders_order_number_unique` (`order_number`),
  KEY `orders_buyer_id_foreign` (`buyer_id`),
  CONSTRAINT `orders_buyer_id_foreign` FOREIGN KEY (`buyer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `order_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `seller_id` BIGINT UNSIGNED NOT NULL,
  `title_snapshot` VARCHAR(255) NOT NULL,
  `unit_price` DECIMAL(14,2) NOT NULL,
  `quantity` INT UNSIGNED NOT NULL,
  `commission_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `order_items_order_id_foreign` (`order_id`),
  KEY `order_items_product_id_foreign` (`product_id`),
  KEY `order_items_seller_id_foreign` (`seller_id`),
  CONSTRAINT `order_items_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `order_items_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `order_items_seller_id_foreign` FOREIGN KEY (`seller_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `disputes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT UNSIGNED NOT NULL,
  `raised_by` BIGINT UNSIGNED NOT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `details` TEXT NULL,
  `status` ENUM('open', 'in_review', 'resolved', 'rejected') NOT NULL DEFAULT 'open',
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `disputes_order_id_foreign` (`order_id`),
  KEY `disputes_raised_by_foreign` (`raised_by`),
  CONSTRAINT `disputes_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `disputes_raised_by_foreign` FOREIGN KEY (`raised_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `conversations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_one_id` BIGINT UNSIGNED NOT NULL,
  `user_two_id` BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NULL,
  `last_message_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `conversations_users_product_unique` (`user_one_id`, `user_two_id`, `product_id`),
  KEY `conversations_user_two_id_foreign` (`user_two_id`),
  KEY `conversations_product_id_foreign` (`product_id`),
  CONSTRAINT `conversations_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL,
  CONSTRAINT `conversations_user_one_id_foreign` FOREIGN KEY (`user_one_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `conversations_user_two_id_foreign` FOREIGN KEY (`user_two_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `conversation_id` BIGINT UNSIGNED NOT NULL,
  `sender_id` BIGINT UNSIGNED NOT NULL,
  `body` TEXT NOT NULL,
  `read_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `messages_conversation_id_foreign` (`conversation_id`),
  KEY `messages_sender_id_foreign` (`sender_id`),
  CONSTRAINT `messages_conversation_id_foreign` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `messages_sender_id_foreign` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `reviews` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `order_id` BIGINT UNSIGNED NULL,
  `rating` TINYINT UNSIGNED NOT NULL,
  `comment` TEXT NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `reviews_product_id_foreign` (`product_id`),
  KEY `reviews_user_id_foreign` (`user_id`),
  KEY `reviews_order_id_foreign` (`order_id`),
  CONSTRAINT `reviews_order_id_foreign` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `reviews_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reviews_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `notifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `type` ENUM('order', 'message', 'auction', 'promotion', 'account') NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `body` TEXT NULL,
  `link` VARCHAR(255) NULL,
  `read_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `notifications_user_id_foreign` (`user_id`),
  CONSTRAINT `notifications_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `category_commissions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `category_id` BIGINT UNSIGNED NOT NULL,
  `rate_percent` DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `category_commissions_category_id_foreign` (`category_id`),
  CONSTRAINT `category_commissions_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
