BEGIN {
  # Whitelist tabel project (dipakai oleh API mobile)
  whitelist["users"] = 1
  whitelist["data_pegawai"] = 1
  whitelist["struktur"] = 1
  whitelist["app_modul"] = 1
  whitelist["app_role_menu"] = 1
  whitelist["call_version"] = 1
  whitelist["list_dokter_visit_new"] = 1
  whitelist["call_list"] = 1
  whitelist["call_list_history"] = 1
  whitelist["call_plan_actual"] = 1
  whitelist["call_setting"] = 1
  whitelist["call_target_list"] = 1
  whitelist["call_target_hari"] = 1
  whitelist["call_target_class"] = 1
  whitelist["data_product"] = 1
  whitelist["data_spec_dr"] = 1
  whitelist["visit_tidak_kunjungan"] = 1
  whitelist["visit_tidak_kunjungan_mr"] = 1

  outdir = "D:/API-MSF/db-backup"
  active = 0
  outfile = ""
}

/^-- Table structure for `/ {
  match($0, /`[^`]+`/)
  name = substr($0, RSTART + 1, RLENGTH - 2)
  if (active && outfile != "") {
    close(outfile)
  }
  if (name in whitelist) {
    outfile = outdir "/" name ".sql"
    active = 1
    print "-- Extracted from monitoring_2026-05-20_04-52-52.sql" > outfile
    print "-- Source DB: monitoring @ mersimkt.web.id (MariaDB 10.3.39)" >> outfile
    print "-- Table: " name >> outfile
    print "" >> outfile
  } else {
    active = 0
    outfile = ""
  }
}

active && outfile != "" {
  print >> outfile
}

END {
  if (outfile != "") close(outfile)
}
