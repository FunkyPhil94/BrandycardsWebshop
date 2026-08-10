ALTER TABLE `users` ADD `preferred_locale` text NOT NULL DEFAULT 'de' CHECK (`preferred_locale` IN ('de', 'en'));
