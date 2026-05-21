-- Extracted from monitoring_2026-05-20_04-52-52.sql
-- Source DB: monitoring @ mersimkt.web.id (MariaDB 10.3.39)
-- Table: app_modul

-- Table structure for `app_modul`
-- ----------------------------
DROP TABLE IF EXISTS `app_modul`;
CREATE TABLE `app_modul` (
  `id_modul` int(11) NOT NULL AUTO_INCREMENT,
  `nama_modul` varchar(25) NOT NULL,
  `icons` varchar(30) NOT NULL,
  `icons2` varchar(30) DEFAULT NULL,
  `color` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id_modul`),
  UNIQUE KEY `nama_modul` (`nama_modul`)
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- Data for `app_modul` (36 rows)
LOCK TABLES `app_modul` WRITE;
/*!40000 ALTER TABLE `app_modul` DISABLE KEYS */;
INSERT INTO `app_modul` (`id_modul`, `nama_modul`, `icons`, `icons2`, `color`) VALUES
  (1, 'Administrator', 'cil-laptop', 'administrator.png', NULL),
  (2, 'E-Discount', 'cil-tags', 'discount.png', NULL),
  (3, 'Visit', 'cil-people', 'visit.png', NULL),
  (4, 'Adminda', 'cil-laptop', '', NULL),
  (5, 'Promotional Material', 'cil-basket', 'promat.png', '#f3fee8'),
  (8, 'Sales', 'cil-bar-chart', 'sales3.png', '#f3fee8'),
  (9, 'Perjalanan Dinas', 'cil-airplane-mode', 'dinas2.png', NULL),
  (10, 'Inventaris Marketing', 'cil-storage', 'inventaris.png', '#fec3c3'),
  (11, 'Kartu Nama', 'cil-credit-card', 'kartu2.png', NULL),
  (13, 'Service Kendaraan', 'cil-car-alt', 'service.png', NULL),
  (14, 'Sponsorship', 'cil-gift', 'sponsorship.png', NULL),
  (15, 'Absensi', 'cil-clock', 'clock.png', NULL),
  (16, 'Struktur', 'cil-lan', 'struktur.png', NULL),
  (17, 'Dokumen', 'cil-folder-open', 'dokumen.png', NULL),
  (18, 'Event Marketing', 'cil-bullhorn', 'event.png', NULL),
  (19, 'Forecast', 'cil-chart-line', 'forecast.png', '#fec3c3'),
  (20, 'Operasional Kantor', 'cil-factory', 'operasional.png', NULL),
  (21, 'Advance & Expenses', 'cil-money', 'expenses.png', NULL),
  (22, 'Lampiran Sponsorship', 'cil-copy', 'lampiran.png', '#f3fee8'),
  (23, 'File Sales', 'cil-envelope-letter', 'filesales.png', NULL),
  (24, 'Donasi Produk', 'cil-3d', 'donasi.png', '#fec3c3'),
  (25, 'Profile', 'cil-contact', '', NULL),
  (26, 'Purchase Order', 'cil-library', 'po.png', NULL),
  (27, 'Marketing Activity', 'cil-balance-scale', 'activity.png', NULL),
  (28, 'Rental Mobil', 'cil-garage', 'rental2.png', '#fcff5c'),
  (29, 'Live Screen', 'cil-aperture', 'livescreen.png', '#adfea1'),
  (30, 'E-SPB', 'cil-briefcase', 'espb.png', '#adfea1'),
  (31, 'Live Screen Sales', 'cil-aperture', 'livescreen2.png', '#adfea1'),
  (32, 'Stock', 'cil-storage', 'stock2.png', NULL),
  (33, 'Helpdesk', 'cil-settings', 'helpdesk.png', NULL),
  (34, 'Sales Analysis Report', 'cil-bar-chart', 'analisasales2.png', NULL),
  (35, 'Induction', 'cil-people', 'induction.png', '#adfea1'),
  (36, 'Mobile Apps', 'cil-laptop', 'mobile.png', NULL),
  (37, 'Rating MMS', 'cil-laptop', 'rating.png', NULL),
  (38, 'MSF Mobile', 'cil-people', 'mersi.png', NULL),
  (39, 'Budget Analysis', 'cil-bar-chart', 'budgetanalysis2.png', NULL);
/*!40000 ALTER TABLE `app_modul` ENABLE KEYS */;
UNLOCK TABLES;

-- ----------------------------
