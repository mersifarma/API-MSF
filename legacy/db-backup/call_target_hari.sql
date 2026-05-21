-- Extracted from monitoring_2026-05-20_04-52-52.sql
-- Source DB: monitoring @ mersimkt.web.id (MariaDB 10.3.39)
-- Table: call_target_hari

-- Table structure for `call_target_hari`
-- ----------------------------
DROP TABLE IF EXISTS `call_target_hari`;
CREATE TABLE `call_target_hari` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `jabatan` varchar(20) NOT NULL,
  `divisi` varchar(50) NOT NULL,
  `dokter` int(11) NOT NULL,
  `non_dokter` int(11) DEFAULT NULL,
  `periode_awal` date DEFAULT NULL,
  `periode_akhir` date DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- Data for `call_target_hari` (24 rows)
LOCK TABLES `call_target_hari` WRITE;
/*!40000 ALTER TABLE `call_target_hari` DISABLE KEYS */;
INSERT INTO `call_target_hari` (`id`, `jabatan`, `divisi`, `dokter`, `non_dokter`, `periode_awal`, `periode_akhir`) VALUES
  (1, 'MR', 'JUPITER', 10, 2, '2026-01-01', NULL),
  (2, 'PS', 'JUPITER', 10, 2, '2026-01-01', NULL),
  (3, 'KAE', 'JUPITER', 10, 2, '2026-01-01', NULL),
  (4, 'MR', 'MERCURY', 10, 2, '2026-01-01', NULL),
  (5, 'PS', 'MERCURY', 10, 2, '2026-01-01', NULL),
  (6, 'KAE', 'MERCURY', 10, 2, '2026-01-01', NULL),
  (7, 'MR', 'NEPTUNE 1', 4, 6, '2026-01-01', NULL),
  (8, 'PS', 'NEPTUNE 1', 4, 6, '2026-01-01', NULL),
  (9, 'KAE', 'NEPTUNE 1', 4, 6, '2026-01-01', NULL),
  (10, 'MR', 'NEPTUNE 2', 4, 6, '2026-01-01', NULL),
  (11, 'PS', 'NEPTUNE 2', 4, 6, '2026-01-01', NULL),
  (12, 'KAE', 'NEPTUNE 2', 4, 6, '2026-01-01', NULL),
  (13, 'DM', 'JUPITER', 4, 1, '2026-01-01', NULL),
  (14, 'ACT. DM', 'JUPITER', 4, 1, '2026-01-01', NULL),
  (15, 'DM', 'MERCURY', 4, 1, '2026-01-01', NULL),
  (16, 'ACT. DM', 'MERCURY', 4, 1, '2026-01-01', NULL),
  (17, 'DM', 'NEPTUNE 1', 2, 4, '2026-01-01', NULL),
  (18, 'ACT. DM', 'NEPTUNE 1', 2, 4, '2026-01-01', NULL),
  (19, 'DM', 'NEPTUNE 2', 2, 4, '2026-01-01', NULL),
  (20, 'ACT. DM', 'NEPTUNE 2', 2, 4, '2026-01-01', NULL),
  (21, 'RSM', 'JUPITER', 2, 1, '2026-01-01', NULL),
  (22, 'RSM', 'MERCURY', 2, 1, '2026-01-01', NULL),
  (23, 'RSM', 'NEPTUNE 1', 2, 2, '2026-01-01', NULL),
  (24, 'RSM', 'NEPTUNE 2', 2, 2, '2026-01-01', NULL);
/*!40000 ALTER TABLE `call_target_hari` ENABLE KEYS */;
UNLOCK TABLES;

-- ----------------------------
