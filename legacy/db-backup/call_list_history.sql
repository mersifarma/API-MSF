-- Extracted from monitoring_2026-05-20_04-52-52.sql
-- Source DB: monitoring @ mersimkt.web.id (MariaDB 10.3.39)
-- Table: call_list_history

-- Table structure for `call_list_history`
-- ----------------------------
DROP TABLE IF EXISTS `call_list_history`;
CREATE TABLE `call_list_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `call_list_id` int(11) NOT NULL,
  `id_peg` int(11) NOT NULL,
  `action_type` varchar(20) NOT NULL,
  `action_date` datetime DEFAULT current_timestamp(),
  `old_id_mcl` int(11) DEFAULT NULL,
  `new_id_mcl` int(11) DEFAULT NULL,
  `old_nama_dokter` varchar(255) DEFAULT NULL,
  `new_nama_dokter` varchar(255) DEFAULT NULL,
  `old_spec` varchar(255) DEFAULT NULL,
  `new_spec` varchar(255) DEFAULT NULL,
  `old_class` varchar(5) DEFAULT NULL,
  `old_segmen` varchar(50) DEFAULT NULL,
  `new_segmen` varchar(50) DEFAULT NULL,
  `old_wilayah` varchar(30) DEFAULT NULL,
  `new_wilayah` varchar(30) DEFAULT NULL,
  `old_target_visit` int(11) DEFAULT NULL,
  `new_target_visit` int(11) DEFAULT NULL,
  `new_class` varchar(5) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `call_list_id` (`call_list_id`),
  KEY `id_peg` (`id_peg`),
  KEY `action_date` (`action_date`)
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Data for `call_list_history` (35 rows)
LOCK TABLES `call_list_history` WRITE;
/*!40000 ALTER TABLE `call_list_history` DISABLE KEYS */;
INSERT INTO `call_list_history` (`id`, `call_list_id`, `id_peg`, `action_type`, `action_date`, `old_id_mcl`, `new_id_mcl`, `old_nama_dokter`, `new_nama_dokter`, `old_spec`, `new_spec`, `old_class`, `old_segmen`, `new_segmen`, `old_wilayah`, `new_wilayah`, `old_target_visit`, `new_target_visit`, `new_class`, `reason`, `ip_address`, `user_agent`) VALUES
  (1, 78511, 3283, 'edit', '2026-05-04 09:01:45', 1206, 1206, 'ALIFIATI FITRIKASARI', 'ALIFIATI FITRIKASARI', 'PSYCHIATRIST', 'PSYCHIATRIST', 'AB', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'BC', 'turun kelas', '114.10.4.150', NULL),
  (2, 78580, 3283, 'edit', '2026-05-04 09:02:59', 16799, 16799, 'RIHADINI', 'RIHADINI', 'PSYCHIATRIST', 'PSYCHIATRIST', 'AB', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'BC', 'turun kelas', '114.10.4.150', NULL),
  (3, 78549, 3283, 'edit', '2026-05-04 09:03:29', 9648, 9648, 'ICHDINAVIA HARSAYA', 'ICHDINAVIA HARSAYA', 'PSYCHIATRIST', 'PSYCHIATRIST', 'AB', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'BC', 'turun kelas', '114.10.4.150', NULL),
  (4, 85513, 3260, 'edit', '2026-05-04 09:09:52', 6226, 6226, 'ELA KUSTILA', 'ELA KUSTILA', 'NEUROLOGIST', 'NEUROLOGIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti class', '114.122.75.121', NULL),
  (5, 85550, 3260, 'edit', '2026-05-04 09:22:10', 9170, 9170, 'HILMI UMASANGADJI', 'HILMI UMASANGADJI', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti class', '114.122.75.121', NULL),
  (6, 85618, 3260, 'edit', '2026-05-04 09:23:01', 11830, 11830, 'LENNY IRAWATI YOHOSUA', 'LENNY IRAWATI YOHOSUA', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '114.122.75.121', NULL),
  (7, 85591, 3260, 'edit', '2026-05-04 09:23:58', 15456, 15456, 'PARAMITHA KUSUMA', 'PARAMITHA KUSUMA', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kls', '114.122.75.121', NULL),
  (8, 85828, 3260, 'edit', '2026-05-04 09:24:50', 15888, 15888, 'PUSPITA DWI WARDHANI', 'PUSPITA DWI WARDHANI', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'gnti kls', '114.122.75.121', NULL),
  (9, 85688, 3263, 'edit', '2026-05-04 09:33:11', 10625, 10625, 'JANE MARGARETHA', 'JANE MARGARETHA', 'NEUROLOGIST', 'NEUROLOGIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (10, 85672, 3263, 'edit', '2026-05-04 09:34:00', 9170, 9170, 'HILMI UMASANGADJI', 'HILMI UMASANGADJI', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (11, 86120, 3263, 'edit', '2026-05-04 09:34:31', 3416, 3416, 'BETA AYU NATALIA', 'BETA AYU NATALIA', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (12, 85703, 3263, 'edit', '2026-05-04 09:35:01', 40532, 40532, 'JANIASMAN ALEXSANDRO SINURAT', 'JANIASMAN ALEXSANDRO SINURAT', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (13, 85712, 3263, 'edit', '2026-05-04 09:35:39', 31578, 31578, 'KIKI PUSPITASARI', 'KIKI PUSPITASARI', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (14, 86084, 3263, 'edit', '2026-05-04 09:36:05', 11830, 11830, 'LENNY IRAWATI YOHOSUA', 'LENNY IRAWATI YOHOSUA', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (15, 85728, 3263, 'edit', '2026-05-04 09:36:44', 31589, 31589, 'LEONY WIDJAJA', 'LEONY WIDJAJA', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (16, 85751, 3263, 'edit', '2026-05-04 09:37:27', 12132, 12132, 'LOLLYTHA CHRISTIANTY S', 'LOLLYTHA CHRISTIANTY S', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (17, 85763, 3263, 'edit', '2026-05-04 09:38:05', 21913, 21913, 'MARSUDI', 'MARSUDI', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (18, 85772, 3263, 'edit', '2026-05-04 09:38:38', 13128, 13128, 'MEDIA YUNI KURNIAWATI', 'MEDIA YUNI KURNIAWATI', 'NEUROLOGIST', 'NEUROLOGIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (19, 85801, 3263, 'edit', '2026-05-04 09:39:15', 14682, 14682, 'NOKI IRAWAN', 'NOKI IRAWAN', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (20, 85810, 3263, 'edit', '2026-05-04 09:39:47', 15438, 15438, 'PANGERAN ERICSON ARTHUR SIAHAAN', 'PANGERAN ERICSON ARTHUR SIAHAAN', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (21, 85826, 3263, 'edit', '2026-05-04 09:40:17', 15456, 15456, 'PARAMITHA KUSUMA', 'PARAMITHA KUSUMA', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (22, 86108, 3263, 'edit', '2026-05-04 09:40:48', 15888, 15888, 'PUSPITA DWI WARDHANI', 'PUSPITA DWI WARDHANI', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (23, 85854, 3263, 'edit', '2026-05-04 09:41:17', 16084, 16084, 'RADEN DEWI RAHMI KUSUMAWARDHANI KUSUMO', 'RADEN DEWI RAHMI KUSUMAWARDHANI KUSUMO', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (24, 85871, 3263, 'edit', '2026-05-04 09:41:46', 16270, 16270, 'RAMA GIOVANI', 'RAMA GIOVANI', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (25, 85915, 3263, 'edit', '2026-05-04 09:42:24', 18778, 18778, 'STEPHEN ISKANDAR', 'STEPHEN ISKANDAR', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (26, 85950, 3263, 'edit', '2026-05-04 09:42:57', 18888, 18888, 'SUGIARTO HALIM', 'SUGIARTO HALIM', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (27, 85983, 3263, 'edit', '2026-05-04 09:43:28', 21901, 21901, 'TITIN', 'TITIN', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (28, 86006, 3263, 'edit', '2026-05-04 09:44:05', 41019, 41019, 'WIM ZWEIRYADINDA', 'WIM ZWEIRYADINDA', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (29, 86026, 3263, 'edit', '2026-05-04 09:44:48', 21021, 21021, 'WULIA TITIANA NUGRAHA', 'WULIA TITIANA NUGRAHA', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (30, 86039, 3263, 'edit', '2026-05-04 09:45:17', 21297, 21297, 'YOLLY YUBHAR', 'YOLLY YUBHAR', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (31, 86069, 3263, 'edit', '2026-05-04 09:46:29', 31561, 31561, 'ZULFITRIANI', 'ZULFITRIANI', 'PSYCHIATRIST', 'PSYCHIATRIST', 'CC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'CC', 'ganti kelas', '182.10.129.203', NULL),
  (32, 91535, 3990, 'edit', '2026-05-06 19:05:43', 20750, 42142, 'WIDYAWATI SUHENDRO', 'ALYA HANANTI', 'NEUROLOGIST', 'PSYCHIATRIST', 'BC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'BC', 'user urgent untuk mengejar memo standarisasi produk', '182.3.46.61', NULL),
  (33, 91502, 3990, 'edit', '2026-05-06 19:07:16', 41504, 43348, 'VANIA RAFELIA', 'VIONA VABELLA TJIU', 'PSYCHIATRIST', 'PSYCHIATRIST', 'BC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'BC', 'user urgent untuk mengejar memo standarisasi produk', '182.3.42.162', NULL),
  (34, 90756, 3996, 'edit', '2026-05-06 20:18:25', 12135, 42142, 'LORA SINTANI', 'ALYA HANANTI', 'PSYCHIATRIST', 'PSYCHIATRIST', 'BC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'BC', 'user baru untuk mendukung ttd memo pengajuan', '114.4.83.3', NULL),
  (35, 90464, 3996, 'edit', '2026-05-11 18:03:38', 4136, 12982, 'CITRA FITRI AGUSTINA', 'Maula Nuruddin Gaharu', 'PSYCHIATRIST', 'NEUROLOGIST', 'BC', 'Doctor', 'Doctor', NULL, NULL, NULL, NULL, 'BC', 'di karenakan di ganti Rs Polri masih pareto', '114.10.115.250', NULL);
/*!40000 ALTER TABLE `call_list_history` ENABLE KEYS */;
UNLOCK TABLES;

-- ----------------------------
