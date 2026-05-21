-- Extracted from monitoring_2026-05-20_04-52-52.sql
-- Source DB: monitoring @ mersimkt.web.id (MariaDB 10.3.39)
-- Table: call_target_class

-- Table structure for `call_target_class`
-- ----------------------------
DROP TABLE IF EXISTS `call_target_class`;
CREATE TABLE `call_target_class` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `jabatan` varchar(15) NOT NULL,
  `class` varchar(5) NOT NULL,
  `target` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_call_target_class` (`jabatan`,`class`)
) ENGINE=InnoDB AUTO_INCREMENT=55 DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- Data for `call_target_class` (54 rows)
LOCK TABLES `call_target_class` WRITE;
/*!40000 ALTER TABLE `call_target_class` DISABLE KEYS */;
INSERT INTO `call_target_class` (`id`, `jabatan`, `class`, `target`) VALUES
  (1, 'MR', 'AA', 4),
  (2, 'MR', 'AB', 4),
  (3, 'MR', 'AC', 4),
  (4, 'MR', 'BA', 4),
  (5, 'MR', 'BB', 3),
  (6, 'MR', 'BC', 2),
  (7, 'MR', 'CA', 2),
  (8, 'MR', 'CB', 2),
  (9, 'MR', 'CC', 2),
  (10, 'PS', 'AA', 4),
  (11, 'PS', 'AB', 4),
  (12, 'PS', 'AC', 4),
  (13, 'PS', 'BA', 4),
  (14, 'PS', 'BB', 3),
  (15, 'PS', 'BC', 2),
  (16, 'PS', 'CA', 2),
  (17, 'PS', 'CB', 2),
  (18, 'PS', 'CC', 2),
  (19, 'KAE', 'AA', 4),
  (20, 'KAE', 'AB', 4),
  (21, 'KAE', 'AC', 4),
  (22, 'KAE', 'BA', 4),
  (23, 'KAE', 'BB', 3),
  (24, 'KAE', 'BC', 2),
  (25, 'KAE', 'CA', 2),
  (26, 'KAE', 'CB', 2),
  (27, 'KAE', 'CC', 2),
  (28, 'ACT. DM', 'AA', 2),
  (29, 'ACT. DM', 'AB', 2),
  (30, 'ACT. DM', 'AC', 2),
  (31, 'ACT. DM', 'BA', 2),
  (32, 'ACT. DM', 'BB', 1),
  (33, 'ACT. DM', 'BC', 1),
  (34, 'ACT. DM', 'CA', 1),
  (35, 'ACT. DM', 'CB', 1),
  (36, 'ACT. DM', 'CC', 1),
  (37, 'DM', 'AA', 2),
  (38, 'DM', 'AB', 2),
  (39, 'DM', 'AC', 2),
  (40, 'DM', 'BA', 2),
  (41, 'DM', 'BB', 1),
  (42, 'DM', 'BC', 1),
  (43, 'DM', 'CA', 1),
  (44, 'DM', 'CB', 1),
  (45, 'DM', 'CC', 1),
  (46, 'RSM', 'AA', 2),
  (47, 'RSM', 'AB', 2),
  (48, 'RSM', 'AC', 2),
  (49, 'RSM', 'BA', 2),
  (50, 'RSM', 'BB', 1),
  (51, 'RSM', 'BC', 1),
  (52, 'RSM', 'CA', 1),
  (53, 'RSM', 'CB', 1),
  (54, 'RSM', 'CC', 1);
/*!40000 ALTER TABLE `call_target_class` ENABLE KEYS */;
UNLOCK TABLES;

-- ----------------------------
