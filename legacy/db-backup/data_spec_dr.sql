-- Extracted from monitoring_2026-05-20_04-52-52.sql
-- Source DB: monitoring @ mersimkt.web.id (MariaDB 10.3.39)
-- Table: data_spec_dr

-- Table structure for `data_spec_dr`
-- ----------------------------
DROP TABLE IF EXISTS `data_spec_dr`;
CREATE TABLE `data_spec_dr` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `spec` varchar(50) NOT NULL,
  `gelar` varchar(20) DEFAULT NULL,
  `keterangan` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `spec` (`spec`)
) ENGINE=InnoDB AUTO_INCREMENT=61 DEFAULT CHARSET=utf8 COLLATE=utf8_general_ci;

-- Data for `data_spec_dr` (60 rows)
LOCK TABLES `data_spec_dr` WRITE;
/*!40000 ALTER TABLE `data_spec_dr` DISABLE KEYS */;
INSERT INTO `data_spec_dr` (`id`, `spec`, `gelar`, `keterangan`) VALUES
  (1, 'ANAESTHESIOLOGIST', 'SpAn', 'Anastesi (Pembiusan)'),
  (2, 'ANATOMICAL PATHOLOGIST', 'SpPA', 'Patologi Anatomi'),
  (3, 'CARDIOLOGIST', 'SpJP', 'Jantung dan Pembuluh Darah'),
  (4, 'CLINICAL PATHOLOGIST', 'SpPK', 'Patologi Klinik'),
  (5, 'DENTIST', 'SpKG', 'Dokter Gigi'),
  (6, 'DERMATOLOGIST', 'SpKK', 'Kulit, Rambut Kuku dan Selaput Lendir'),
  (7, 'DIGESTIVE SURGEON', 'SpBD', 'Bedah Sistem Pencernaan'),
  (8, 'DIGESTIVE SURGEON ONCOLOGIST', 'SpB-KBD', 'Kanker Sistem Pencernaan'),
  (9, 'ENDOCRINOLOGIST', 'KEMD', 'Sistem Endrokin'),
  (10, 'GASTROENTEROLOGIST', 'KGEH', 'Sistem Pencernaan'),
  (11, 'GENERAL PRACTIONER', 'GP', 'Dokter Umum'),
  (12, 'GERIATRICIAN', 'Kger', 'Spesialis Lansia'),
  (13, 'HEMATOLOGY ONCOLOGIST', 'SpPDK KHOM', 'Kanker Darah'),
  (14, 'HEMATOLOGIST', 'KHOM', 'Darah, Sumsum Tulang, Sistem Limfatik'),
  (15, 'HEPATOLOGIST', 'KGEH', 'Organ hati, Kantong empedu, Pankreas'),
  (16, 'INTERNIST', 'SpPD', 'Penyakit Dalam'),
  (17, 'NEFROLOGIST', 'KGH', 'Ginjal'),
  (18, 'NEUROLOGIST', 'SpS', 'Saraf'),
  (19, 'NEUROSURGEON', 'SpBS', 'Bedah Saraf'),
  (20, 'NURSE', 'SKep', 'Perawat'),
  (21, 'OBGYN', 'SpOG', 'Reproduksi Wanita'),
  (22, 'OBSTETRIAN ONCOLOGIST', 'SpOG ( K ) OnK', 'Kanker Reproduksi wanita'),
  (23, 'ONCOLOGIST', 'SpOnkRad', 'Kanker'),
  (24, 'ONCOLOGIST SURGEON', 'SpB ( K ) OnK', 'Bedah Onkologi'),
  (25, 'OPTHALMOLOGIST', 'SpM', 'Mata'),
  (26, 'ORTHOPAEDIC SURGEON', 'SpOT', 'Bedah Ortopedi'),
  (27, 'ORTHOPEDIC ONCOLOGIST', 'SpOT ( K ) OnK', 'Kanker Ortopedi'),
  (28, 'OTHERS', 'OTH', ''),
  (29, 'OTOLARINGOLOGIST', 'SpTHTKL', ''),
  (30, 'OTORHINOLARYNGOLOGIST', 'SpTHTKL', 'THT (Telinga Hidung Tenggorokan)'),
  (31, 'PAEDIATRIC HEMATOLOGIST', 'SpA ( K ) HOM', 'Kanker Darah pada Anak'),
  (32, 'PATOLOGIST', 'SpPA', 'jaringan, darah, dan cairan tubuh'),
  (33, 'PEDIATRIC SURGEON', 'SpBA', 'Bedah pada Anak'),
  (34, 'PEDIATRICIAN', 'SpA', 'Spesialis Anak'),
  (35, 'PHARMACIST', 'SFarm, Apt', 'Apoteker'),
  (36, 'PLASTIC SURGEON', 'SpBP', 'Bedah Plastik'),
  (37, 'PSYCHIATRIST', 'SpKJ', 'Kesehatan Jiwa'),
  (38, 'PSYKOLOG', 'S.Psi', 'Psikolog'),
  (39, 'PULMONOLOGIST', 'SpP', 'Paru'),
  (40, 'PULMONOLOGY ONCOLOGIST', 'Sp.P ( K ) OnK', 'Kanker Paru'),
  (41, 'RADIOLOGIST', 'Sp.Rad', 'Radiologi'),
  (42, 'RADIOLOGI ONCOLOGIST', 'SpRad ( K ) OnK', 'Onkologi Radiasi'),
  (43, 'RHEUMATOLOGIST', 'KR', 'Rhematologi (sendi, otot, tulang, ligamen, dan ten'),
  (44, 'SURGEON', 'SpB', 'Bedah Umum'),
  (45, 'THORACIC SURGEON', 'SpBT-KV', 'Bedah Rongga Dada ( jantung, paru-paru, kerongkong'),
  (46, 'UROLOGIST', 'SpU', 'Sistem saluran kemih'),
  (47, 'VASCULAR SURGEON', 'SpBV', 'pembuluh darah arteri, vena, dan limfatik'),
  (48, 'ANDROLOGI', 'Sp.And', 'Reproduksi Pria'),
  (49, 'ORTHODONTIST', 'Sp.Ort', 'Struktur Gigi'),
  (50, 'OTHERS (PENATA ANAESTHESI)', 'OTH', NULL),
  (51, 'OTHERS (PENGADAAN)', 'OTH', NULL),
  (52, 'OTHERS (MANAGEMENT RS)', 'OTH', NULL),
  (53, 'OTHERS (SATUAN KERJA)', 'OTH', NULL),
  (54, 'ORAL SURGERY', 'Sp.BM', 'Bedah Mulut'),
  (55, 'GENERAL SURGERY', 'Sp.B', 'Bedah Umum'),
  (56, 'SURGICAL ONCOLOGY', 'Sp.B(K)Onk', 'Bedah Onkologi'),
  (57, 'ORTHOPEDIC SURGERY', 'Sp.BO', 'Bedah Ortopedi'),
  (58, 'AKUPUNKTUR MEDIK', 'SpAK', 'Spesialis Akupunktur'),
  (59, 'REHABILITASI MEDIK', 'Sp.RM', NULL),
  (60, 'EPIDEMIOLOG', 'S.Kes', NULL);
/*!40000 ALTER TABLE `data_spec_dr` ENABLE KEYS */;
UNLOCK TABLES;

-- ----------------------------
