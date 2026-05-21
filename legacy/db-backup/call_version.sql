-- Extracted from monitoring_2026-05-20_04-52-52.sql
-- Source DB: monitoring @ mersimkt.web.id (MariaDB 10.3.39)
-- Table: call_version

-- Table structure for `call_version`
-- ----------------------------
DROP TABLE IF EXISTS `call_version`;
CREATE TABLE `call_version` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `version` varchar(20) DEFAULT NULL,
  `link_apk` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- Data for `call_version` (1 rows)
LOCK TABLES `call_version` WRITE;
/*!40000 ALTER TABLE `call_version` DISABLE KEYS */;
INSERT INTO `call_version` (`id`, `version`, `link_apk`) VALUES
  (1, '8.1.29', 'https://monitoring.mersimkt.web.id/downloadmobilerev4');
/*!40000 ALTER TABLE `call_version` ENABLE KEYS */;
UNLOCK TABLES;

-- ----------------------------
