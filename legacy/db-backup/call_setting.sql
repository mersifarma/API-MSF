-- Extracted from monitoring_2026-05-20_04-52-52.sql
-- Source DB: monitoring @ mersimkt.web.id (MariaDB 10.3.39)
-- Table: call_setting

-- Table structure for `call_setting`
-- ----------------------------
DROP TABLE IF EXISTS `call_setting`;
CREATE TABLE `call_setting` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user` int(11) DEFAULT NULL,
  `nama` varchar(75) DEFAULT NULL,
  `bulan` varchar(20) DEFAULT NULL,
  `input_set` varchar(50) DEFAULT NULL,
  `jumlah` int(11) DEFAULT NULL,
  `created_date` datetime DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- Data for `call_setting` (9 rows)
LOCK TABLES `call_setting` WRITE;
/*!40000 ALTER TABLE `call_setting` DISABLE KEYS */;
INSERT INTO `call_setting` (`id`, `user`, `nama`, `bulan`, `input_set`, `jumlah`, `created_date`, `created_by`, `updated_date`, `updated_by`) VALUES
  (28, 2119, 'DIAH RETNO KARTIKA', 'May-2026', 'Call List', 9, '2026-05-11 08:43:40', 2, NULL, NULL),
  (29, 129, 'GRISTANTI YUWANDA', 'May-2026', 'Approval Call List', 9, '2026-05-11 08:43:50', 2, NULL, NULL),
  (30, 1633, 'IRVAN NASUTION', 'May-2026', 'Call List', 9, '2026-05-11 08:56:11', 2, NULL, NULL),
  (31, 1558, 'KRISTIAN WIJAYA', 'May-2026', 'Approval Call List', 9, '2026-05-11 08:56:22', 2, NULL, NULL),
  (35, 2120, 'PRIA ARCHIE ARYAGUNA', 'May-2026', 'Call List', 10, '2026-05-12 09:50:16', 2, NULL, NULL),
  (36, 1968, 'GANGAN GANDARA', 'May-2026', 'Approval Call List', 10, '2026-05-12 09:50:44', 2, NULL, NULL),
  (37, 2122, 'ANAS SAIFUDDIN', 'May-2026', 'Call List', 11, '2026-05-13 09:17:07', 2, NULL, NULL),
  (38, 1854, 'NURINI WIDYANINGSIH', 'May-2026', 'Approval Call List', 11, '2026-05-13 09:17:33', 2, NULL, NULL),
  (39, 1917, 'MUJIBURROHMAN', 'May-2026', 'Approval Call List', 13, '2026-05-15 09:25:52', 2, NULL, NULL);
/*!40000 ALTER TABLE `call_setting` ENABLE KEYS */;
UNLOCK TABLES;

-- ----------------------------
