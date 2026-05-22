<?php

namespace App\Http\Controllers\Api;

use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Models\list_dokter_visit;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

// class VisitController extends Controller      
class VisitController_dev extends Controller    
{
    // ============================================================================
    // KONFIGURASI BATAS WAKTU ADD CALL LIST
    // BATAS_HARI_KERJA_LIST : hari kerja awal bulan untuk add call list
    //                         Contoh: 5 = hanya boleh sampai hari kerja ke-5 tiap bulan
    //                         Set ke null untuk menonaktifkan validasi ini
    //
    // OVERRIDE_BULAN_LIST   : skip validasi untuk bulan tertentu
    //                         Format: 'YYYY-MM' (contoh: '2025-03')
    //                         Kosongkan string ('') jika tidak ada override
    // ============================================================================
    const BATAS_HARI_KERJA_LIST = 20;   // ← ubah angka ini jika perlu
    const OVERRIDE_BULAN_LIST   = '';  // ← isi 'YYYY-MM' jika ada override bulan tertentu

    // CEK VERSI APLIKASI — dipanggil di awal setiap fungsi write/save
    private function checkAppVersion(Request $req)
    {
        $version = trim($req->header('X-App-Version', ''));
        if (empty($version)) {
            return response()->json([
                'success' => false,
                'code'    => 'VERSION_OUTDATED',
                'message' => 'Aplikasi Anda tidak kompatibel dan tidak bisa digunakan. Silakan update ke versi terbaru.',
            ], 426);
        }
        return null;
    }

    //MCL menu ------------------------------------
    public function doctorList(Request $req)
    {
        $query = DB::table('list_dokter_visit_new')->select(
            'id_md',
            'nama_dokter',
            'spec',
            'class',
            'segmen_md',
            'institusi',
            'hari_praktek',
            'jam_mulai_praktek',
            'jam_selesai_praktek',
            'divisi',
            'id_peg',
            'id_ff',
        )->where(function ($q) {
            $q->whereNull('STATUS_MD')
                ->orWhere('STATUS_MD', 'AKTIF');
        })->orderBy('nama_dokter', 'ASC');

        if ($req->search) {
            $search = $req->search;

            $query->where(function ($q) use ($search) {
                $q->where('nama_dokter', 'LIKE', "%$search%")
                    ->orWhere('institusi', 'LIKE', "%$search%");
            });
        }

        if ($req->specFilter) {
            $query->where('spec', $req->specFilter);
        }

        if ($req->classFilter) {
            $query->where('class', $req->classFilter);
        }

        if ($req->id_peg) {
            $idPegArray = json_decode($req->id_peg, true);

            if (is_array($idPegArray) && count($idPegArray) > 0) {
                $pegawai = DB::table('data_pegawai')->select(DB::raw('group_concat(distinct jabatan) as jabatan'), DB::raw('group_concat(distinct divisi) as divisi'))->whereIn('rowid', $idPegArray)->first();

                $divisiArray = $pegawai->divisi ? explode(',', $pegawai->divisi) : [];
                $isPEPM = str_contains($pegawai->jabatan, 'PE') || str_contains($pegawai->jabatan, 'PM');

                $struktur = DB::table('struktur')->select(DB::raw('group_concat(distinct id_peg_mr) as id_peg'))->whereRaw('"' . date('Y-m-d') . '" between periode_awal and periode_akhir')
                    ->where(function ($q) use ($idPegArray, $isPEPM, $divisiArray) {

                        // DM / RSM
                        $q->whereIn('id_peg_dm', $idPegArray)
                            ->orWhereIn('id_peg_rsm', $idPegArray);

                        // KHUSUS PE / PM → tambah kondisi divisi
                        if ($isPEPM && !empty($divisiArray)) {
                            $q->orWhere(function ($sub) use ($divisiArray) {
                                $sub->whereIn('divisi', $divisiArray);
                            });
                        }
                    })->first();

                $strukturPeg = !empty($struktur->id_peg)
                    ? explode(',', $struktur->id_peg)
                    : [];


                $query->where(function ($q) use ($idPegArray, $strukturPeg) {
                    // pegawai sendiri
                    $q->whereIn('id_peg', $idPegArray);
                    // bawahan struktur
                    if (!empty($strukturPeg)) {
                        $q->orWhereIn('id_peg', $strukturPeg);
                    }
                });
            } else {
                $query->where('id_peg', '0');
            }
        }

        $results = $query->get();

        return response()->json([
            'success' => true,
            'data' => $results
        ]);
    }

    //Call List menu ------------------------------------
    public function displayCallList(Request $req)
    {
        $idPegList = $req->input('id_peg');

        $query = DB::table('call_list');

        if ($idPegList) {
            $idPegArray = json_decode($idPegList, true);

            if (is_array($idPegArray) && count($idPegArray) > 0) {
                $query->whereIn('id_peg', $idPegArray);
            } else {
                $query->where('id_peg', '0');
            }
        }

        $data = $query->get();

        return response()->json([
            'data' => $data
        ]);
    }

    // GET CALL LIST DATA - Untuk Call Report (dengan filter periode)
    public function getCallListData(Request $req)
    {
        $idPegList = $req->input('id_peg');
        $periode = $req->input('periode'); // Format: "2025-12-01"

        $query = DB::table('call_list');

        // Filter 1: id_peg (user filter)
        if ($idPegList) {
            $idPegArray = json_decode($idPegList, true);

            if (is_array($idPegArray) && count($idPegArray) > 0) {
                $query->whereIn('id_peg', $idPegArray);
            } else {
                $query->where('id_peg', '0');
            }
        }

        // Filter 2: periode (YEAR-MONTH filter)
        if ($periode) {
            // Parse periode untuk mendapatkan year dan month
            $periodeDate = \Carbon\Carbon::parse($periode);
            $year = $periodeDate->year;
            $month = $periodeDate->month;

            // Filter dengan WHERE YEAR(periode) = ? AND MONTH(periode) = ?
            $query->whereYear('periode', $year)
                ->whereMonth('periode', $month);
        }

        $data = $query->get();

        return response()->json([
            'success' => true,
            'data' => $data
        ]);
    }

    public function getCallList(Request $req)
    {
        $search = $req->search ?? '';
        $idPeg  = $req->id_peg ?? null;
        $idFf   = $req->id_ff ?? null;
        // Periode untuk filter customer yang sudah ada di call list
        $periode = $req->periode ?? null;

        if (!empty($idPeg)) {
            $decoded = json_decode($idPeg, true);
            if (is_array($decoded)) {
                $getjabatan = DB::table('data_pegawai')->select('jabatan', 'rowid', 'id')->whereIn('rowid', $decoded)->where(DB::raw('ifnull(status,"Exist")'), 'Exist')->first();
            } else {
                $getjabatan = DB::table('data_pegawai')->select('jabatan', 'rowid', 'id')->where('rowid', $idPeg)->where(DB::raw('ifnull(status,"Exist")'), 'Exist')->first();
            }
        }

        // LEFT JOIN dengan call_list untuk filter customer yang sudah ada - Hanya tampilkan customer yang BELUM ada di call_list untuk periode yang sama
        $query = DB::table('list_dokter_visit_new as master_dokter')
            ->select(
                'master_dokter.id_mcl',
                'master_dokter.segmen_md',
                'master_dokter.nama_dokter',
                'master_dokter.spec',
                // 'master_dokter.id_peg',
                DB::raw('master_dokter.id_peg as id_peg_mr'),
                DB::raw('
                case
                when "' . $getjabatan->jabatan . '"="ACT. DM" or "' . $getjabatan->jabatan . '"="DM" then
                (select id_peg_dm from struktur where id_peg_mr=master_dokter.id_peg and "' . date('Y-m-d') . '" between periode_awal and periode_akhir group by id_peg_dm) 
                when "' . $getjabatan->jabatan . '"="PE" or "' . $getjabatan->jabatan . '"="PM" then
                "' . $getjabatan->rowid . '"
                when "' . $getjabatan->jabatan . '"="RSM" then
                (select id_peg_rsm from struktur where id_peg_mr=master_dokter.id_peg and "' . date('Y-m-d') . '" between periode_awal and periode_akhir group by id_peg_rsm) 
                else
                master_dokter.id_peg
                end as id_peg
                '),
                // 'master_dokter.id_ff'
                DB::raw('
                case
                when "' . $getjabatan->jabatan . '"="ACT. DM" or "' . $getjabatan->jabatan . '"="DM" then
                (select id_dm from struktur where id_peg_mr=master_dokter.id_peg and "' . date('Y-m-d') . '" between periode_awal and periode_akhir group by id_dm) 
                when "' . $getjabatan->jabatan . '"="PE" or "' . $getjabatan->jabatan . '"="PM" then
                "' . $getjabatan->id . '"
                when "' . $getjabatan->jabatan . '"="RSM" then
                (select id_rsm from struktur where id_peg_mr=master_dokter.id_peg and "' . date('Y-m-d') . '" between periode_awal and periode_akhir group by id_rsm) 
                else
                master_dokter.id_ff
                end as id_ff
                '),
                DB::raw('master_dokter.id_ff as id_ff_mr')
            )->where(DB::raw('ifnull(master_dokter.STATUS_MD,"AKTIF")'), 'AKTIF');

        //  FILTER: Exclude customer yang sudah ada di call_list dengan periode yang sama
        if (!empty($periode) && !empty($idPeg)) {
            $decoded = json_decode($idPeg, true);
            if (is_array($decoded) && count($decoded) > 0) {
                // LEFT JOIN untuk cek apakah customer sudah ada di call_list
                $query->leftJoin('call_list', function ($join) use ($periode, $decoded) {
                    $join->on('master_dokter.id_mcl', '=', 'call_list.id_mcl')
                        ->where('call_list.periode', '=', $periode)
                        ->whereIn('call_list.id_peg', $decoded);
                });
                // Hanya ambil customer yang BELUM ada di call_list (call_list.id_mcl IS NULL)
                $query->whereNull('call_list.id_mcl');
            }
        }

        if (!empty(trim($search))) {
            $query->where('master_dokter.nama_dokter', 'LIKE', "%$search%");
        }

        if (!empty($idPeg)) {
            $decoded = json_decode($idPeg, true);
            if (is_array($decoded)) {
                // $query->whereIn('master_dokter.id_peg', $decoded);
                $pegawai = DB::table('data_pegawai')->select(DB::raw('group_concat(distinct jabatan) as jabatan'), DB::raw('group_concat(distinct divisi) as divisi'))->whereIn('rowid', $decoded)->first();

                $divisiArray = $pegawai->divisi ? explode(',', $pegawai->divisi) : [];
                $isPEPM = str_contains($pegawai->jabatan, 'PE') || str_contains($pegawai->jabatan, 'PM');

                $struktur = DB::table('struktur')->select(DB::raw('group_concat(distinct id_peg_mr) as id_peg'))->whereRaw('"' . date('Y-m-d') . '" between periode_awal and periode_akhir')
                    ->where(function ($q) use ($decoded, $isPEPM, $divisiArray) {

                        // DM / RSM
                        $q->whereIn('id_peg_dm', $decoded)
                            ->orWhereIn('id_peg_rsm', $decoded);

                        // KHUSUS PE / PM → tambah kondisi divisi
                        if ($isPEPM && !empty($divisiArray)) {
                            $q->orWhere(function ($sub) use ($divisiArray) {
                                $sub->whereIn('divisi', $divisiArray);
                            });
                        }
                    })->first();

                $strukturPeg = !empty($struktur->id_peg)
                    ? explode(',', $struktur->id_peg)
                    : [];

                $query->where(function ($q) use ($decoded, $strukturPeg, $isPEPM, $divisiArray) {

                    // pegawai sendiri
                    $q->whereIn('master_dokter.id_peg', $decoded);

                    // bawahan struktur
                    if (!empty($strukturPeg)) {
                        $q->orWhereIn('master_dokter.id_peg', $strukturPeg);
                    }
                });
            } else {
                // $query->where('master_dokter.id_peg', $idPeg);
                $pegawai = DB::table('data_pegawai')->select(DB::raw('group_concat(distinct jabatan) as jabatan'), DB::raw('group_concat(distinct divisi) as divisi'))->where('rowid', $idPeg)->first();

                $divisiArray = $pegawai->divisi ? explode(',', $pegawai->divisi) : [];
                $isPEPM = str_contains($pegawai->jabatan, 'PE') || str_contains($pegawai->jabatan, 'PM');

                $struktur = DB::table('struktur')->select(DB::raw('group_concat(distinct id_peg_mr) as id_peg'))->whereRaw('"' . date('Y-m-d') . '" between periode_awal and periode_akhir')
                    ->where(function ($q) use ($idPeg, $isPEPM, $divisiArray) {

                        // DM / RSM
                        $q->where('id_peg_dm', $idPeg)
                            ->orWhere('id_peg_rsm', $idPeg);

                        // KHUSUS PE / PM → tambah kondisi divisi
                        if ($isPEPM && !empty($divisiArray)) {
                            $q->orWhere(function ($sub) use ($divisiArray) {
                                $sub->whereIn('divisi', $divisiArray);
                            });
                        }
                    })->first();

                $strukturPeg = !empty($struktur->id_peg)
                    ? explode(',', $struktur->id_peg)
                    : [];

                $query->where(function ($q) use ($idPeg, $strukturPeg, $isPEPM, $divisiArray) {

                    // pegawai sendiri
                    $q->where('master_dokter.id_peg', $idPeg);

                    // bawahan struktur
                    if (!empty($strukturPeg)) {
                        $q->orWhereIn('master_dokter.id_peg', $strukturPeg);
                    }
                });
            }
        }

        $query->where(function ($q) {
            $q->whereNull('master_dokter.status_md')
                ->orWhere('master_dokter.status_md', 'AKTIF');
        })->groupBy(
            'master_dokter.id_mcl',
            'master_dokter.segmen_md',
            'master_dokter.nama_dokter',
            'master_dokter.spec',
            'master_dokter.id_peg',
            'master_dokter.id_ff'
        )->orderBy('master_dokter.nama_dokter');
        // $query->limit(100);
        $doctors = $query->get();

        if ($doctors->isEmpty()) {
            return response()->json([
                'success' => true,
                'data' => [],
            ]);
        }

        $idMclList = $doctors->pluck('id_mcl')->unique()->toArray();
        $idFfList = $doctors->pluck('id_ff_mr')->filter()->unique()->toArray();
        $idPegList = $doctors->pluck('id_peg_mr')->filter()->unique()->toArray();

        $institusiList = DB::table('list_dokter_visit_new')
            ->whereIn('id_mcl', $idMclList)
            ->whereIn('id_ff', $idFfList)
            ->whereIn('id_peg', $idPegList)
            ->Where(DB::raw('ifnull(status_md,"AKTIF")'), 'AKTIF')
            ->select('id_mcl', 'institusi')
            ->distinct()
            ->get()
            ->groupBy('id_mcl')
            ->map(function ($items) {
                return $items->unique('institusi')->values();
            });

        $praktekList = DB::table('list_dokter_visit_new')
            ->whereIn('id_mcl', $idMclList)
            ->whereIn('id_ff', $idFfList)
            ->whereIn('id_peg', $idPegList)
            ->Where(DB::raw('ifnull(status_md,"AKTIF")'), 'AKTIF')
            ->select('id_mcl', 'alamat_praktek')
            ->distinct()
            ->get()
            ->groupBy('id_mcl')
            ->map(function ($items) {
                return $items->unique('alamat_praktek')->values();
            });


        $classList = DB::table('list_dokter_visit_new')
            ->whereIn('id_mcl', $idMclList)
            ->whereIn('id_ff', $idFfList)
            ->whereIn('id_peg', $idPegList)
            ->Where(DB::raw('ifnull(status_md,"AKTIF")'), 'AKTIF')
            ->select('id_mcl', DB::raw('MIN(class) as class'))
            ->groupBy('id_mcl')
            ->pluck('class', 'id_mcl');


        $data = $doctors->map(function ($doctor) use ($institusiList, $praktekList, $classList) {
            return [
                'id_mcl' => $doctor->id_mcl,
                'segmen_md' => $doctor->segmen_md,
                'nama_dokter' => $doctor->nama_dokter,
                'spec' => $doctor->spec,
                'institusi' => $institusiList[$doctor->id_mcl] ?? [],
                'alamat_praktek' => $praktekList[$doctor->id_mcl] ?? [],
                'id_peg' => $doctor->id_peg,
                'id_ff' => $doctor->id_ff,
                'class' => $classList[$doctor->id_mcl] ?? [],
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    public function getMonthlyCount(Request $req)
    {
        // Return total + per-tipe (Dokter & Non-Dokter)-Digunakan Flutter untuk cek limit per tipe sebelum save
        $total = DB::table('call_list')
            ->where('id_peg', $req->id_peg)
            ->where('periode', $req->periode)
            ->count();

        $countDokter = DB::table('call_list')
            ->where('id_peg', $req->id_peg)
            ->where('periode', $req->periode)
            ->where('segmen', 'Doctor')
            ->count();

        $countNonDokter = DB::table('call_list')
            ->where('id_peg', $req->id_peg)
            ->where('periode', $req->periode)
            ->where('segmen', 'Non-Doctor')
            ->count();

        return response()->json([
            'success' => true,
            'count' => $total,
            'count_dokter' => $countDokter,
            'count_non_dokter' => $countNonDokter,
        ]);
    }

    public function saveCallList(Request $req)
    {
        $v = $this->checkAppVersion($req);
        if ($v) return $v;
        date_default_timezone_set('Asia/Jakarta');

        $validated = $req->validate([
            'id_mcl'  => 'required',
            'periode' => 'required|date',
        ], [
            'id_mcl.required'  => 'id_mcl cannot be null.',
            'periode.required' => 'Periode cannot be null.',
        ]);

        // [CONFIG] CEK BATAS WAKTU ADD CALL LIST
        $cekpegawai = DB::table('call_setting as a')->join('data_pegawai as b', function ($join) {
            $join->on('a.user', '=', 'b.id_user');
        })->select('b.rowid', 'a.jumlah')->where('b.rowid', $req->id_peg)->where('a.input_set', 'Call List')->first();

        if (self::BATAS_HARI_KERJA_LIST !== null && empty($cekpegawai->rowid)) {
            $bulanPeriode = Carbon::parse($req->periode)->format('Y-m');

            // Jika ada override bulan tertentu, skip validasi untuk bulan itu
            if (empty(self::OVERRIDE_BULAN_LIST) || trim(self::OVERRIDE_BULAN_LIST) !== $bulanPeriode) {
                $periodeAwal  = Carbon::createFromFormat('Y-m-d', $req->periode, 'Asia/Jakarta')->startOfDay();
                $workDayCount = 0;
                $deadline     = $periodeAwal->copy();

                while (true) {
                    if ($deadline->isWeekday()) {
                        $workDayCount++;
                        if ($workDayCount >= self::BATAS_HARI_KERJA_LIST) break;
                    }
                    $deadline->addDay();
                }

                if (Carbon::now('Asia/Jakarta')->startOfDay()->gt($deadline->startOfDay())) {
                    $deadlineFormatted = $deadline->translatedFormat('d F Y');
                    return response()->json([
                        'success'    => false,
                        'error_code' => 'ADD_CALL_LIST_EXPIRED',
                        'message'    => 'Penambahan call list tidak dapat dilakukan. Batas waktu ' . self::BATAS_HARI_KERJA_LIST . " hari kerja awal bulan sudah terlewat (deadline: {$deadlineFormatted}).",
                    ], 422);
                }
            }
        } else {
            $bulanPeriode = Carbon::parse($req->periode)->format('Y-m');

            // Jika ada override bulan tertentu, skip validasi untuk bulan itu
            if (empty(self::OVERRIDE_BULAN_LIST) || trim(self::OVERRIDE_BULAN_LIST) !== $bulanPeriode) {
                $periodeAwal  = Carbon::createFromFormat('Y-m-d', $req->periode, 'Asia/Jakarta')->startOfDay();
                $workDayCount = 0;
                $deadline     = $periodeAwal->copy();

                while (true) {
                    if ($deadline->isWeekday()) {
                        $workDayCount++;
                        if ($workDayCount >= $cekpegawai->jumlah) break;
                    }
                    $deadline->addDay();
                }

                if (Carbon::now('Asia/Jakarta')->startOfDay()->gt($deadline->startOfDay())) {
                    $deadlineFormatted = $deadline->translatedFormat('d F Y');
                    return response()->json([
                        'success'    => false,
                        'error_code' => 'ADD_CALL_LIST_EXPIRED',
                        'message'    => 'Penambahan call list tidak dapat dilakukan. Batas waktu ' . self::BATAS_HARI_KERJA_LIST . " hari kerja awal bulan sudah terlewat (deadline: {$deadlineFormatted}).",
                    ], 422);
                }
            }
        }

        //limit 1 doctor name/month
        $exists = DB::table('call_list')
            ->where('id_peg', $req->id_peg)
            ->where('id_mcl', $req->id_mcl)
            ->where('periode', $req->periode)
            ->exists();

        if ($exists) {
            return response()->json([
                'success'    => false,
                'error_code' => 'DUPLICATE_DOCTOR',
                'message'    => 'Dokter sudah ada di call list bulan ini.',
            ], 400);
        }


        // Limit dinamis dari tabel call_target_list per jabatan & divisi
        // Cek per tipe segmen: Dokter vs target_dokter, Non-Dokter vs target_non_dokter
        $pegawai = DB::table('data_pegawai')
            ->select('jabatan', 'divisi')
            ->where('rowid', $req->id_peg)
            ->first();

        if ($pegawai) {
            $target = DB::table('call_target_list')
                ->where('jabatan', $pegawai->jabatan)
                ->where('divisi', $pegawai->divisi)
                ->where('periode_awal', '<=', $req->periode)
                ->where(function ($q) use ($req) {
                    $q->whereNull('periode_akhir')
                        ->orWhere('periode_akhir', '>=', $req->periode);
                })
                ->first();

            if ($target) {
                $segmen = $req->segmen ?? 'Doctor'; // 'Doctor' atau 'Non-Doctor'

                if ($segmen === 'Doctor') {
                    $cekpeg = DB::table('data_pegawai')->select(DB::raw('group_concat(distinct rowid) as id_peg'))
                        ->whereRaw('id_user in (select id_user from data_pegawai where rowid = ?)', [$req->id_peg])
                        ->where(DB::raw('ifnull(status,"exist")'), 'exist')
                        // ->where('status', 'exist')
                        ->first();

                    $idPegIds = $cekpeg ? explode(',', $cekpeg->id_peg) : [$req->id_peg];
                    $countDokter = DB::table('call_list')
                        // ->where('id_peg', $req->id_peg)
                        ->whereIn('id_peg', $idPegIds)
                        ->where('periode', $req->periode)
                        ->where('segmen', 'Doctor')
                        ->count();
                    if ($countDokter >= $target->dokter) {
                        return response()->json([
                            'success'    => false,
                            'error_code' => 'TARGET_DOKTER_FULL',
                            'message'    => "Target Dokter sudah penuh (maks. {$target->dokter}).",
                        ], 400);
                    }
                } else {
                    $cekpeg = DB::table('data_pegawai')->select(DB::raw('group_concat(distinct rowid) as id_peg'))
                        ->whereRaw('id_user in (select id_user from data_pegawai where rowid = ?)', [$req->id_peg])
                        ->where(DB::raw('ifnull(status,"exist")'), 'exist')
                        // ->where('status', 'exist')
                        ->first();

                    $idPegIds = $cekpeg ? explode(',', $cekpeg->id_peg) : [$req->id_peg];
                    $countNonDokter = DB::table('call_list')
                        // ->where('id_peg', $req->id_peg)
                        ->whereIn('id_peg', $idPegIds)
                        ->where('periode', $req->periode)
                        ->where('segmen', 'Non-Doctor')
                        ->count();
                    if ($countNonDokter >= $target->non_dokter) {
                        return response()->json([
                            'success'    => false,
                            'error_code' => 'TARGET_NON_DOKTER_FULL',
                            'message'    => "Target Non-Dokter sudah penuh (maks. {$target->non_dokter}).",
                        ], 400);
                    }
                }
            }
        }

        //Get Wilayah Luar Kota untuk Target Visit menjadi 1
        $getjabatan = DB::table('data_pegawai')
            ->select('jabatan')
            ->where('rowid', $req->id_peg)
            ->first();

        $getstruktur = DB::table('struktur')
            ->select(DB::raw('GROUP_CONCAT(DISTINCT id_peg_mr) as id_peg'))
            ->whereRaw('? BETWEEN periode_awal AND periode_akhir', [$req->periode])
            ->where(function ($q) use ($req) {
                $q->where('id_peg_mr', $req->id_peg)
                    ->orWhere('id_peg_dm', $req->id_peg)
                    ->orWhere('id_peg_rsm', $req->id_peg);
            })
            ->first();

        $ids = (!empty($getstruktur->id_peg)) ? explode(',', $getstruktur->id_peg) : [];

        $gettarget = DB::table('list_dokter_visit_new')
            ->select(DB::raw('ifnull(max(wilayah), "Dalam Kota") as wilayah'), DB::raw('ifnull(max(wilayah_dm), "Dalam Kota") as wilayah_dm'), DB::raw('ifnull(max(wilayah_rsm), "Dalam Kota") as wilayah_rsm'))
            ->whereIn('id_peg', $ids)
            ->where('id_mcl', $req->id_mcl)
            ->where(DB::raw('IFNULL(status_md,"AKTIF")'), 'AKTIF')
            ->first();

        $target_visit = null;
        $wilayah = null;

        if ($getjabatan && $gettarget) {

            if (in_array($getjabatan->jabatan, ['MR', 'PS', 'KAE']) && $gettarget->wilayah == 'Luar Kota') {
                $target_visit = 1;
                $wilayah = 'Luar Kota';
            } elseif (in_array($getjabatan->jabatan, ['DM', 'ACT. DM']) && $gettarget->wilayah_dm == 'Luar Kota') {
                $target_visit = 1;
                $wilayah = 'Luar Kota';
            } elseif ($getjabatan->jabatan == 'RSM' && $gettarget->wilayah_rsm == 'Luar Kota') {
                $target_visit = 1;
                $wilayah = 'Luar Kota';
            }
        }

        $insertDt = DB::table('call_list')->insertGetId([
            'id_mcl'       => $req->id_mcl,
            'periode'      => $req->periode,
            'nama_dokter'  => $req->nama_dokter ?? '',
            'spec'         => $req->spec ?? '',
            'segmen'       => $req->segmen ?? '',
            'id_peg'       => $req->id_peg,
            'id_ff'        => $req->id_ff ?? '',
            'class'        => $req->class ?? '',
            'target_visit' => $target_visit,
            'wilayah'      => $wilayah,
            'created_date' => date('Y-m-d H:i:s'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Call list saved successfully.',
            'id' => $insertDt
        ]);
    }

    //Call Plan menu ------------------------------------
    public function displayCallPlan(Request $req)
    {
        $idPegList = $req->input('id_peg');

        $query = DB::table('call_plan_actual')->where('tgl_plan', '!=', null);

        if ($idPegList) {
            $idPegArray = json_decode($idPegList, true);

            if (is_array($idPegArray) && count($idPegArray) > 0) {
                $query->whereIn('id_peg', $idPegArray);
            } else {
                $query->where('id_peg', '0');
            }
        }

        if ($req->monthYear) {
            $query->where('tgl_plan', 'LIKE', "{$req->monthYear}%");
        }

        if ($req->dateSearch) {
            $query->where('tgl_plan', $req->dateSearch);
        }

        if ($req->search) {
            $search = $req->search;

            $query->where(function ($q) use ($search) {
                $q->where('nama_dokter', 'LIKE', "%$search%")
                    ->orWhere('institusi', 'LIKE', "%$search%");
            });
        }

        $data = $query->get();

        return response()->json([
            'data' => $data
        ]);
    }

    public function callPlanDoctor(Request $req)
    {
        $search = $req->search ?? '';
        $idPeg  = $req->id_peg ?? null;
        $year   = $req->year;
        $month  = $req->month;

        $query = DB::table('call_list')
            ->select('id_mcl', 'id_ff', 'nama_dokter', 'spec', 'segmen', 'class', 'id_peg')
            ->where('approval', '=', 'Approve');

        if (!empty(trim($search))) {
            $query->where('nama_dokter', 'LIKE', "%$search%");
        }

        if (!empty($year) && !empty($month)) {
            $query->whereYear('periode', $year)
                ->whereMonth('periode', $month);
        }

        if (!empty($idPeg)) {
            $decoded = json_decode($idPeg, true);

            if (is_array($decoded)) {
                $query->whereIn('id_peg', $decoded);
            } else {
                $query->where('id_peg', $idPeg);
            }
        }

        $doctors = $query->orderBy('nama_dokter', 'asc')->get();

        return response()->json([
            'success' => true,
            'data' => $doctors
        ]);
    }

    public function callPlanInst(Request $req)
    {
        $idMcl = $req->id_mcl ?? null;
        $idFF = $req->id_ff ?? null;

        $idFFArray = [];

        if (!empty($idFF)) {
            $decoded = json_decode($idFF, true);
            $idFFArray = is_array($decoded) ? $decoded : [$idFF];

            $getjabatan = DB::table('data_pegawai')
                ->selectRaw('
                    MAX(jabatan) as jabatan,
                    MAX(rowid) as rowid,
                    MAX(id) as id,
                    MAX(nama) as nama,
                    GROUP_CONCAT(DISTINCT divisi) as divisi
                ')
                ->whereIn('id', $idFFArray)
                ->whereRaw('IFNULL(status,"Exist") = "Exist"')
                ->first();
        }

        if (!$idMcl && !$idFF) {
            return response()->json([
                'success' => false,
                'message' => 'id_mcl and id_ff are required.'
            ]);
        }

        $isPEPM = str_contains($getjabatan->jabatan, 'PE') || str_contains($getjabatan->jabatan, 'PM');
        $divisiArray = !empty($getjabatan->divisi)
            ? explode(',', $getjabatan->divisi)
            : [];
        $today = date('Y-m-d');

        $results = DB::table('list_dokter_visit_new as z')
            ->select(
                // 'id_ff',
                // 'nama_ff',
                DB::raw('z.id_ff as id_ff_mr'),
                DB::raw('z.nama_ff as nama_ff_mr'),
                DB::raw('
                case
                when "' . $getjabatan->jabatan . '"="ACT. DM" or "' . $getjabatan->jabatan . '"="DM" then
                (select id_dm from struktur where id_mr=z.id_ff and "' . date('Y-m-d') . '" between periode_awal and periode_akhir group by id_dm) 
                when "' . $getjabatan->jabatan . '"="PE" or "' . $getjabatan->jabatan . '"="PM" then
                "' . $getjabatan->id . '"
                when "' . $getjabatan->jabatan . '"="RSM" then
                (select id_rsm from struktur where id_mr=z.id_ff and "' . date('Y-m-d') . '" between periode_awal and periode_akhir group by id_rsm) 
                else
                z.id_ff
                end as id_ff
                '),
                DB::raw('
                case
                when "' . $getjabatan->jabatan . '"="ACT. DM" or "' . $getjabatan->jabatan . '"="DM" then
                (select b.nama from struktur a join data_pegawai b on a.id_peg_dm=b.rowid where a.id_mr=z.id_ff and "' . date('Y-m-d') . '" between a.periode_awal and a.periode_akhir group by b.nama) 
                when "' . $getjabatan->jabatan . '"="PE" or "' . $getjabatan->jabatan . '"="PM" then
                "' . $getjabatan->nama . '"
                when "' . $getjabatan->jabatan . '"="RSM" then
                (select b.nama from struktur a join data_pegawai b on a.id_peg_rsm=b.rowid where a.id_mr=z.id_ff and "' . date('Y-m-d') . '" between a.periode_awal and a.periode_akhir group by b.nama) 
                else
                z.nama_ff
                end as nama_ff
                '),
                'z.divisi',
                'z.institusi',
                'z.alamat_praktek',
                'z.koordinat_institusi',
                'z.id_mcl',
                'z.segmen_md'
            )
            ->where('z.id_mcl', (int)$idMcl)

            ->where(function ($q) use ($idFFArray, $isPEPM, $divisiArray, $today) {

                $q->whereIn('z.id_peg', function ($sub) use ($idFFArray, $isPEPM, $divisiArray, $today) {

                    $sub->select('id_peg_mr')
                        ->from('struktur')
                        ->whereRaw('? BETWEEN periode_awal AND periode_akhir', [$today]);

                    if ($isPEPM && !empty($divisiArray)) {

                        $sub->whereIn('divisi', $divisiArray);
                    } else {

                        $sub->where(function ($x) use ($idFFArray) {
                            $x->whereIn('id_mr', $idFFArray)
                                ->orWhereIn('id_dm', $idFFArray)
                                ->orWhereIn('id_rsm', $idFFArray);
                        });
                    }
                });
            })
            ->Where(DB::raw('ifnull(z.status_md,"AKTIF")'), 'AKTIF')
            ->orderBy('z.institusi')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $results
        ]);
    }

    // Ambil daftar produk aktif dari data_product - Filter by divisi jika parameter divisi dikirim dari mobile
    public function getProductList(Request $req)
    {
        $query = DB::table('data_product')
            ->where('status', 'AKTIF');

        if ($req->filled('divisi')) {
            $query->where('divisi', $req->divisi);
        }

        $products = $query
            ->select(
                    'id_product',
                    'nama_product',
                    'jenis_product',
                    'kemasan',
                    'product_detail_link'
                    )
            ->orderBy('nama_product')
            ->get();

        return response()->json([
            'success' => true,
            'data'    => $products,
        ]);
    }

    public function saveCallPlan(Request $req)
    {
        $v = $this->checkAppVersion($req);
        if ($v) return $v;
        date_default_timezone_set('Asia/Jakarta');

        $validated = $req->validate([
            'id_mcl'  => 'required',
            'tgl_plan' => 'required|date',
            'waktu' => 'required'
        ], [
            'id_mcl.required'  => 'id_mcl cannot be null.',
            'tgl_plan.required' => 'tgl_plan cannot be null.',
            'waktu.required'   => 'Waktu cannot be null.',
        ]);

        $insertDt = DB::table('call_plan_actual')->insertGetId([
            'id_peg'              => $req->id_peg,
            'id_ff'               => $req->id_ff ?? '',
            'nama_ff'             => $req->nama_ff ?? '',
            'divisi'              => $req->divisi ?? '',
            'tgl_plan'            => $req->tgl_plan ?? '',
            'waktu'               => $req->waktu ?? '',
            'id_mcl'              => $req->id_mcl,
            'nama_dokter'         => $req->nama_dokter ?? '',
            'spec'                => $req->spec ?? '',
            'segmen_md'           => $req->segmen_md ?? '',
            'class'               => $req->class ?? '',
            'institusi'           => $req->institusi ?? '',
            'alamat_praktek'      => $req->alamat_praktek ?? '',
            'keterangan'          => $req->keterangan ?? '',
            // simpan JSON array produk yang dipilih; null jika tidak dipilih
            'product_list'        => $req->product_list ?? null,
            'status'              => $req->status ?? '',
            'koordinat_institusi' => $req->koordinat_institusi ?? '',
            'created_date'        => date('Y-m-d H:i:s'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Call list saved successfully.',
            'id' => $insertDt
        ]);
    }

    //Call Actual menu ------------------------------------
    public function getActualDetails($id)
    {
        $data = DB::table('call_plan_actual')
            ->where('id', $id)
            ->first();

        if (!$data) {
            return response()->json([
                'success' => false,
                'message' => 'Data not found'
            ], 404);
        }

        $result = (array) $data;

        // [Join Visit] Resolve nama peserta join visit
        // join_visit_id di record MR berisi comma-separated peg ID atasan (e.g. "3207,3919")
        // Hanya resolve jika join_visit = 1 dan status BUKAN 'join_visit'
        // (record 'join_visit' adalah milik atasan, bukan MR)
        $joinVisitNames = [];

        if (!empty($data->join_visit_ff)) {

            if (($data->status ?? '') !== 'join_visit') {
                // MR record: join_visit_ff berisi comma-separated peg ID atasan
                $idParts = array_filter(array_map('trim', explode(',', $data->join_visit_ff)));
                foreach ($idParts as $pegId) {
                    $pegId = (int) $pegId;
                    if ($pegId <= 0) continue;
                    $pegData = DB::table('data_pegawai')->where('rowid', $pegId)->select('rowid', 'nama')->first();
                    if ($pegData) $joinVisitNames[] = $pegData->nama;
                }
            } else {
                // Atasan record: join_visit_ff berisi ID record MR (call_plan_actual.id)
                // Resolve: nama MR + nama atasan lain yang ikut join visit yang sama
                $mrRecordId = (int) trim($data->join_visit_ff);
                if ($mrRecordId > 0) {
                    $mrRecord = DB::table('call_plan_actual')
                        ->select('id_peg', 'join_visit_ff')
                        ->where('id', $mrRecordId)
                        ->first();
                    if ($mrRecord) {
                        // Tambah nama MR
                        $mrPeg = DB::table('data_pegawai')->select('nama')->where('rowid', $mrRecord->id_peg)->first();
                        if ($mrPeg) $joinVisitNames[] = $mrPeg->nama;
                        // Tambah nama atasan lain dari MR record
                        if (!empty($mrRecord->join_visit_ff)) {
                            $atasanIds = array_filter(array_map('trim', explode(',', $mrRecord->join_visit_ff)));
                            foreach ($atasanIds as $atasanPegId) {
                                $atasanPegId = (int) $atasanPegId;
                                if ($atasanPegId <= 0 || $atasanPegId == $data->id_peg) continue;
                                $peg = DB::table('data_pegawai')->select('nama')->where('rowid', $atasanPegId)->first();
                                if ($peg) $joinVisitNames[] = $peg->nama;
                            }
                        }
                    }
                }
            }
        }

        $result['join_visit_names'] = $joinVisitNames; // [Join Visit] Nama peserta join visit

        return response()->json([
            'success' => true,
            'data' => $result
        ]);
    }

    //save planned actual
    public function saveActual(Request $req)
    {
        $v = $this->checkAppVersion($req);
        if ($v) return $v;
        date_default_timezone_set('Asia/Jakarta');

        $validated = $req->validate([
            'id'         => 'required|exists:call_plan_actual,id',
            'koor_visit' => 'required|string|max:100',
            // [S3] foto_link wajib ada — Flutter wajib upload ke S3 sebelum save
            'foto_link'  => 'required|url',
        ]);

        if ($req->tgl_actual != date('Y-m-d')) {
            return response()->json([
                'success' => false,
                'error_code' => 'INVALID_TIME_SETTING',
                'message' => "Anda merubah tanggal device, sesuaikan dengan tanggal sekarang.\nUntuk WIT & WITA kunjungan mulai dari Pukul 02.30."
            ], 500);
        }

        // Toleransi waktu 2 jam untuk multi waktu di indonesia (misal MR di WIT, server di WIB → selisih 1-2 jam)

        // ============================================================
        // CEK BATAS WAKTU 1 JAM SEJAK KUNJUNGAN DILAKUKAN
        // Gabungkan tgl_actual + waktu_actual menjadi Carbon datetime,
        // lalu bandingkan dengan waktu sekarang di server.
        // Jika selisih > 60 menit, tolak penyimpanan.
        // ============================================================
        if ($req->tgl_actual && $req->waktu_actual && str_contains($req->status, 'offline')) {
            $waktuKunjungan = Carbon::createFromFormat('Y-m-d H:i:s', $req->tgl_actual . ' ' . $req->waktu_actual, 'Asia/Jakarta');
            $selisihMenit   = Carbon::now('Asia/Jakarta')->diffInMinutes($waktuKunjungan, false);

            // $selisihMenit bernilai negatif jika waktu kunjungan sudah lewat
            if ($selisihMenit < -60) {
                return response()->json([
                    'success'    => false,
                    'error_code' => 'VISIT_TIME_EXPIRED',
                    'message'    => 'Gagal menyimpan: kunjungan sudah lebih dari 1 jam yang lalu.',
                ], 422);
            }
        }

        try {
            // Cek apakah kolom updated_date ada di tabel call_plan_actual
            $columns = DB::getSchemaBuilder()->getColumnListing('call_plan_actual');
            $hasUpdatedDate = in_array('updated_date', $columns);

            $updateData = [
                'keterangan'    => $req->keterangan ?? '',
                'tgl_actual'    => $req->tgl_actual ?? '',
                'waktu_actual'  => $req->waktu_actual ?? '',
                'koor_visit'    => $validated['koor_visit'],
                'stt_koor'      => $req->stt_koor ?? 0,
                'status'        => $req->status ?? '',
                'join_visit'    => $req->join_visit ?? 0,
                'join_visit_ff' => $req->join_visit_id ?? null,
                'foto'          => $req->foto ?? null,
                'tanda_tangan'  => $req->tanda_tangan ?? null,
                // [S3] URL foto & TTD di Object Storage
                'foto_link'      => $req->foto_link ?? null,
                'ttd_link'       => $req->ttd_link ?? null,
                // [S3] Log status upload — JSON string dari Flutter
                's3_upload_log'  => $req->s3_upload_log ?? null,
            ];

            // Jika kolom tidak ada → SQLSTATE Unknown column → 500 Server Error
            if ($hasUpdatedDate) {
                $updateData['updated_date'] = date('Y-m-d H:i:s');
            }

            DB::table('call_plan_actual')
                ->where('id', $req->id)
                ->update($updateData);

            return response()->json([
                'success' => true,
                'id' => $req->id
            ]);
        } catch (\Exception $e) {
            Log::error('saveActual error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Gagal menyimpan actual: ' . $e->getMessage()
            ], 500);
        }
    }

    // ============================================================================
    // [Join Visit] createJoinVisitRecordsForAtasan
    // Membuat record baru di call_plan_actual untuk setiap atasan yang dipilih MR.
    // Record atasan berisi data kunjungan yang sama, namun koor_visit dikosongkan
    // agar atasan wajib menginput lokasi sendiri sebagai konfirmasi kehadiran.
    //
    // Logic:
    // - join_visit_id di record atasan = ID record MR (untuk referensi saat validasi 100m)
    // - status = 'join_visit' untuk membedakan dari record biasa
    // - Tidak membuat record baru jika record serupa sudah ada (cegah duplikasi)
    // ============================================================================
    private function createJoinVisitRecordsForAtasan(int $mrRecordId, string $joinVisitIdStr, bool $hasUpdatedDate): void
    {
        // [Join Visit] Ambil data lengkap record MR
        $mrRecord = DB::table('call_plan_actual')->where('id', $mrRecordId)->first();
        if (!$mrRecord) return;

        // [Join Visit] Parse comma-separated peg ID atasan
        $atasanPegIds = array_filter(array_map('trim', explode(',', $joinVisitIdStr)));

        foreach ($atasanPegIds as $atasanPegId) {
            $atasanPegId = (int) $atasanPegId;
            if ($atasanPegId <= 0) continue;

            // [Join Visit] Cegah duplikasi: skip jika record sudah ada
            // (sama: id_peg atasan + tgl_actual + id_mcl + join_visit_id = mr record id)
            $existing = DB::table('call_plan_actual')
                ->where('id_peg', $atasanPegId)
                ->where('join_visit', 1)
                ->where('status', 'join_visit')
                ->where('join_visit_ff', (string) $mrRecordId)
                ->first();

            if ($existing) continue;

            // [Join Visit] Ambil nama atasan dari data_pegawai (hanya rowid dan nama)
            $atasanData = DB::table('data_pegawai')
                ->where('rowid', $atasanPegId)
                ->select('rowid', 'nama')
                ->first();

            $insertData = [
                'id_peg'              => $atasanPegId,
                // [Join Visit] nama_ff dari data atasan, id_ff & divisi fallback ke MR
                'id_ff'               => $mrRecord->id_ff,
                'nama_ff'             => $atasanData->nama ?? $mrRecord->nama_ff,
                'divisi'              => $mrRecord->divisi,
                // [Join Visit] tgl_plan NULL karena ini bukan planned visit untuk atasan
                'tgl_plan'            => null,
                'waktu'               => null,
                // [Join Visit] Salin data kunjungan dari record MR
                'id_mcl'              => $mrRecord->id_mcl,
                'nama_dokter'         => $mrRecord->nama_dokter,
                'spec'                => $mrRecord->spec,
                'segmen_md'           => $mrRecord->segmen_md,
                'class'               => $mrRecord->class,
                'institusi'           => $mrRecord->institusi,
                'alamat_praktek'      => $mrRecord->alamat_praktek,
                'keterangan'          => $mrRecord->keterangan,
                'koordinat_institusi' => $mrRecord->koordinat_institusi,
                'tgl_actual'          => $mrRecord->tgl_actual,
                'waktu_actual'        => $mrRecord->waktu_actual,
                // [Join Visit] koor_visit DIKOSONGKAN - atasan wajib isi sendiri
                'koor_visit'          => null,
                'stt_koor'            => 0,
                // [Join Visit] Tandai sebagai record join visit
                'status'              => 'join_visit',
                'join_visit'          => 1,
                // [Join Visit] join_visit_id = ID record MR sebagai referensi koordinat
                'join_visit_ff'       => (string) $mrRecordId,
                'created_date'        => date('Y-m-d H:i:s'),
            ];

            if ($hasUpdatedDate) {
                $insertData['updated_date'] = date('Y-m-d H:i:s');
            }

            DB::table('call_plan_actual')->insert($insertData);
        }
    }

    //display actual
    public function displayActual(Request $req)
    {
        $idPegList = $req->input('id_peg');

        $query = DB::table('call_plan_actual');

        $query->whereNotNull('status')
            ->where('status', '!=', '');

        if ($idPegList) {
            $idPegArray = json_decode($idPegList, true);

            if (is_array($idPegArray) && count($idPegArray) > 0) {
                $query->whereIn('id_peg', $idPegArray);
            } else {
                $query->where('id_peg', '0');
            }
        }

        if ($req->monthYear) {
            $query->where('tgl_actual', 'LIKE', "{$req->monthYear}%");
        }

        if ($req->dateSearch) {
            $query->where('tgl_actual', $req->dateSearch);
        }

        if ($req->search) {
            $search = $req->search;
            $query->where(function ($q) use ($search) {
                $q->where('nama_dokter', 'LIKE', "%$search%")
                    ->orWhere('institusi', 'LIKE', "%$search%");
            });
        }

        $data = $query->get();

        return response()->json([
            'data' => $data
        ]);
    }

    //save unplanned/non-target actual
    public function saveUnplanned(Request $req)
    {
        $v = $this->checkAppVersion($req); if ($v) return $v;
        date_default_timezone_set('Asia/Jakarta');

        $validated = $req->validate([
            'koor_visit' => 'required|string|max:100',
            // [S3] foto_link wajib ada — Flutter wajib upload ke S3 sebelum save
            'foto_link'  => 'required|url',
        ]);

        if ($req->tgl_actual != date('Y-m-d')) {
            return response()->json([
                'success' => false,
                'error_code' => 'INVALID_TIME_SETTING',
                'message' => "Anda merubah tanggal device, sesuaikan dengan tanggal sekarang.\nUntuk WIT & WITA kunjungan mulai dari Pukul 02.30."
            ], 500);
        }
        
        // Toleransi waktu 2 jam untuk multi waktu di indonesia (misal MR di WIT, server di WIB → selisih 1-2 jam)

        // ============================================================
        // CEK BATAS WAKTU 1 JAM SEJAK KUNJUNGAN DILAKUKAN
        // Gabungkan tgl_actual + waktu_actual menjadi Carbon datetime,
        // lalu bandingkan dengan waktu sekarang di server.
        // Jika selisih > 60 menit, tolak penyimpanan.
        // ============================================================
        if ($req->tgl_actual && $req->waktu_actual && str_contains($req->status, 'offline')) {
            $waktuKunjungan = Carbon::createFromFormat('Y-m-d H:i:s', $req->tgl_actual . ' ' . $req->waktu_actual, 'Asia/Jakarta');
            $selisihMenit   = Carbon::now('Asia/Jakarta')->diffInMinutes($waktuKunjungan, false);

            // $selisihMenit bernilai negatif jika waktu kunjungan sudah lewat
            if ($selisihMenit < -60) {
                return response()->json([
                    'success'    => false,
                    'error_code' => 'VISIT_TIME_EXPIRED',
                    'message'    => 'Gagal menyimpan: kunjungan sudah lebih dari 1 jam yang lalu.',
                ], 422);
            }
        }
        // Cek duplikasi kunjungan: sama id_peg + id_mcl + tgl_actual
        $tglActual = $req->tgl_actual ?? date('Y-m-d');
        $existingVisit = DB::table('call_plan_actual')
            ->where('id_peg', $req->id_peg)
            ->where('id_mcl', $req->id_mcl)
            ->where('tgl_actual', $tglActual)
            ->whereNotNull('tgl_actual')
            ->where('tgl_actual', '!=', '')
            ->first();

        if ($existingVisit) {
            $namaDokter = $req->nama_dokter ?? 'Dokter ini';
            $tglFormatted = \Carbon\Carbon::parse($tglActual)->format('d/m/Y');
            return response()->json([
                'success' => false,
                'error_code' => 'ALREADY_VISITED_TODAY',
                'message' => "$namaDokter sudah dikunjungi pada $tglFormatted. Kunjungan tidak dapat disimpan lebih dari sekali dalam sehari.",
            ], 422);
        }

        try {
            // Cek apakah kolom updated_date ada (sama seperti saveActual)
            $columns = DB::getSchemaBuilder()->getColumnListing('call_plan_actual');
            $hasUpdatedDate = in_array('updated_date', $columns);

            $insertData = [
                'id_peg'              => $req->id_peg,
                'id_ff'               => $req->id_ff,
                'nama_ff'             => $req->nama_ff,
                'divisi'              => $req->divisi,
                'tgl_plan'            => $req->tgl_plan,
                'waktu'               => $req->waktu,
                'id_mcl'              => $req->id_mcl,
                'nama_dokter'         => $req->nama_dokter,
                'spec'                => $req->spec,
                'segmen_md'           => $req->segmen_md,
                'class'               => $req->class,
                'institusi'           => $req->institusi,
                'alamat_praktek'      => $req->alamat_praktek,
                'keterangan'          => $req->keterangan,
                'status'              => $req->status,
                'koordinat_institusi' => $req->koordinat_institusi,
                'tgl_actual'          => $req->tgl_actual,
                'waktu_actual'        => $req->waktu_actual,
                'koor_visit'          => $validated['koor_visit'],
                'stt_koor'            => $req->stt_koor ?? 0,
                // [Join Visit] Simpan data join visit ke record MR
                'join_visit'          => $req->join_visit ?? 0,
                'join_visit_ff'       => $req->join_visit_id ?? null,
                // simpan product_list sebagai JSON string
                'product_list'        => $req->product_list ?? null,
                // simpan foto & tanda_tangan langsung saat insert - agar atomik — jika frontend kirim nilai, tersimpan bersama data lain
                'foto'                => $req->foto ?? null,
                'tanda_tangan'        => $req->tanda_tangan ?? null,
                // [S3] URL foto & TTD di Object Storage
                'foto_link'      => $req->foto_link ?? null,
                'ttd_link'       => $req->ttd_link ?? null,
                // [S3] Log status upload — JSON string dari Flutter
                's3_upload_log'  => $req->s3_upload_log ?? null,
            ];

            if ($hasUpdatedDate) {
                $insertData['updated_date'] = date('Y-m-d H:i:s');
            }

            $insertDt = DB::table('call_plan_actual')->insertGetId($insertData);

            return response()->json([
                'success' => true,
                'message' => 'Call list saved successfully.',
                'id' => $insertDt
            ]);
        } catch (\Exception $e) {
            $errorMsg = $e->getMessage();
            \Illuminate\Support\Facades\Log::error('saveUnplanned error: ' . $errorMsg);

            // Deteksi duplicate entry (UNIQUE constraint violation di DB)
            if (str_contains($errorMsg, '1062') || str_contains($errorMsg, 'Duplicate entry')) {
                $namaDokter = $req->nama_dokter ?? 'Dokter ini';
                return response()->json([
                    'success' => false,
                    'error_code' => 'ALREADY_VISITED_TODAY',
                    'message' => "$namaDokter sudah pernah dikunjungi hari ini. Data tidak dapat disimpan dua kali.",
                ], 422);
            }

            //  Pesan generik tanpa SQL mentah
            return response()->json([
                'success' => false,
                'message' => 'Gagal menyimpan kunjungan. Silakan coba lagi atau hubungi admin.'
            ], 500);
        }
    }

    public function getNtData(Request $req)
    {
        $idPegList = $req->input('id_peg');

        $search = trim($req->search ?? '');

        $query = DB::table('list_dokter_visit_new')
            ->select(
                DB::raw('MIN(id_mcl) as id_mcl'),
                'nama_dokter',
                DB::raw('MIN(spec) as spec'),
                DB::raw('MIN(segmen_md) as segmen_md'),
                DB::raw('MIN(class) as class'),
                'institusi',
                DB::raw('MIN(alamat_praktek) as alamat_praktek'),
                DB::raw('MIN(koordinat_institusi) as koordinat_institusi')
            )
            ->Where(DB::raw('ifnull(status_md,"AKTIF")'), 'AKTIF')
            ->groupBy('nama_dokter', 'institusi');

        if ($idPegList) {
            $idPegArray = json_decode($idPegList, true);

            if (is_array($idPegArray) && count($idPegArray) > 0) {
                // $query->whereIn('id_peg', $idPegArray);
                $pegawai = DB::table('data_pegawai')->select(DB::raw('group_concat(distinct jabatan) as jabatan'), DB::raw('group_concat(distinct divisi) as divisi'))->whereIn('rowid', $idPegArray)->first();

                $divisiArray = $pegawai->divisi ? explode(',', $pegawai->divisi) : [];
                $isPEPM = str_contains($pegawai->jabatan, 'PE') || str_contains($pegawai->jabatan, 'PM');

                $struktur = DB::table('struktur')->select(DB::raw('group_concat(distinct id_peg_mr) as id_peg'))->whereRaw('"' . date('Y-m-d') . '" between periode_awal and periode_akhir')
                    ->where(function ($q) use ($idPegArray, $isPEPM, $divisiArray) {

                        // DM / RSM
                        $q->whereIn('id_peg_dm', $idPegArray)
                            ->orWhereIn('id_peg_rsm', $idPegArray);

                        // KHUSUS PE / PM → tambah kondisi divisi
                        if ($isPEPM) {
                            $q->orWhere(function ($sub) use ($divisiArray) {
                                $sub->whereIn('divisi', $divisiArray);
                            });
                        }
                    })->first();

                $strukturpeg = !empty($struktur->id_peg)
                    ? explode(',', $struktur->id_peg)
                    : [];

                $query->where(function ($q) use ($idPegArray, $strukturpeg) {
                    $q->whereIn('id_peg', $idPegArray)
                        ->orWhereIn('id_peg', $strukturpeg);
                });
            } else {
                $query->where('id_peg', '0');
            }
        }

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('nama_dokter', 'LIKE', "%$search%")
                    ->orWhere('institusi', 'LIKE', "%$search%");
            });
        }

        return response()->json([
            'success' => true,
            'data' => $query->get(),
        ]);
    }


    public function getFFname(Request $req)
    {
        $data = DB::table('data_pegawai')
            ->select('rowid', 'id', 'nama', 'divisi')
            ->whereIn('rowid', (array) $req->id_peg)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $data
        ]);
    }

    // DELETE CALL LIST - Function untuk menghapus data dari call list
    // RULE: Hanya bisa dihapus jika data tersebut BELUM ada di call_plan_actual
    //       dengan perbandingan YEAR-MONTH antara periode (call_list) dan tgl_plan (call_plan_actual)
    public function deleteCallList(Request $req)
    {
        try {
            //  VALIDASI INPUT - memastikan id_mcl, id_peg, dan periode ada
            $validated = $req->validate([
                'id_mcl' => 'required',
                'id_peg' => 'required',
                'periode' => 'required|date',
            ]);

            //  PARSE PERIODE (dari call_list) - Ambil tahun dan bulan saja
            $periodeDate = \Carbon\Carbon::parse($req->periode);
            $periodeYear = $periodeDate->year;
            $periodeMonth = $periodeDate->month;

            //  CEK APAKAH DATA SUDAH ADA DI CALL PLAN (dengan perbandingan YEAR-MONTH)
            // Data hanya bisa dihapus jika belum ada di call_plan_actual- dengan id_mcl + id_peg + YEAR-MONTH yang sama
            $existsInPlan = DB::table('call_plan_actual')
                ->where('id_mcl', $req->id_mcl)
                ->where('id_peg', $req->id_peg)
                ->whereNotNull('tgl_plan') //  Hanya cek yang sudah ada tgl_plan
                ->where(DB::raw('YEAR(tgl_plan)'), $periodeYear)
                ->where(DB::raw('MONTH(tgl_plan)'), $periodeMonth)
                ->exists();

            //  Jika sudah ada di call plan dengan bulan-tahun yang sama, tolak penghapusan
            if ($existsInPlan) {
                Log::warning('⚠️ DELETE BLOCKED: Customer exists in Call Plan for this month', [
                    'id_mcl' => $req->id_mcl,
                    'id_peg' => $req->id_peg,
                    'periode' => $req->periode,
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'Cannot delete! This customer already has a Call Plan scheduled for ' . $periodeDate->format('F Y') . '.'
                ], 400);
            }

            // Cek status approval - Reject tidak bisa dihapus, harus diedit
            $callListRecord = DB::table('call_list')
                ->where('id_mcl', $req->id_mcl)
                ->where('id_peg', $req->id_peg)
                ->where('periode', $req->periode)
                ->first();

            if ($callListRecord && $callListRecord->approval === 'Reject') {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot delete! Status is Rejected. Please edit the data instead.'
                ], 400);
            }

            //  HAPUS DATA berdasarkan id_mcl, id_peg, DAN periode
            $deleted = DB::table('call_list')
                ->where('id_mcl', $req->id_mcl)
                ->where('id_peg', $req->id_peg)
                ->where('periode', $req->periode)
                ->delete();

            // Cek apakah data berhasil dihapus
            if ($deleted > 0) {
                return response()->json([
                    'success' => true,
                    'message' => 'Call list deleted successfully.',
                    'deleted_rows' => $deleted
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to delete call list. Data not found or already deleted.'
                ], 404);
            }
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::error(' VALIDATION ERROR:', $e->errors());

            return response()->json([
                'success' => false,
                'message' => 'Validation failed: ' . json_encode($e->errors())
            ], 422);
        } catch (\Exception $e) {
            Log::error(' DELETE ERROR:', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ], 500);
        }
    }

    // DELETE CALL PLAN - Function untuk menghapus data dari call plan/actual
    public function deleteCallPlan(Request $req)
    {
        try {
            // Validasi input - memastikan id ada di table call_plan_actual
            $validated = $req->validate([
                'id' => 'required|exists:call_plan_actual,id',
            ]);

            // Ambil data berdasarkan id untuk cek tgl_actual
            $record = DB::table('call_plan_actual')
                ->where('id', $req->id)
                ->first();

            // Jika tidak ditemukan
            if (!$record) {
                return response()->json([
                    'success' => false,
                    'message' => 'Call plan not found.'
                ], 404);
            }

            // Jika sudah ada tgl_actual, tolak penghapusan
            if ($record->tgl_actual !== null && $record->tgl_actual !== '') {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot delete! This plan already has actual visit date.'
                ], 400);
            }

            // Hapus data dari database berdasarkan id
            $deleted = DB::table('call_plan_actual')
                ->where('id', $req->id)
                ->delete();

            // Cek apakah data berhasil dihapus
            if ($deleted) {
                return response()->json([
                    'success' => true,
                    'message' => 'Call plan deleted successfully.'
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to delete call plan.'
                ], 400);
            }
        } catch (\Exception $e) {
            // Handle error jika terjadi exception
            return response()->json([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getReachProdReport(Request $req)
    {
        $idPegList = $req->input('id_peg');

        //main query
        $query = DB::table('call_plan_actual')
            ->where('approval_actual', '=', 'Approve');

        //filter user
        if ($idPegList) {
            $idPegArray = json_decode($idPegList, true);

            if (is_array($idPegArray) && count($idPegArray) > 0) {
                $query->whereIn('id_peg', $idPegArray);
            } else {
                $query->where('id_peg', '0');
            }
        }

        //filter periode
        if ($req->year && $req->month) {
            $query->whereYear('tgl_actual', $req->year)
                ->whereMonth('tgl_actual', $req->month);
        }

        //doctor
        $qDoc = (clone $query)->where('segmen_md', 0);
        //non-doctor
        $qNonDoc = (clone $query)->where('segmen_md', 1);

        $periodeLike = sprintf('%04d-%02d', $req->year, $req->month) . '%';

        $reachDoc = (clone $qDoc)
            ->whereNotNull('status')
            ->whereExists(function ($exists) use ($periodeLike, $idPegArray) {
                $exists->select(DB::raw(1))
                    ->from('call_list')
                    ->whereColumn('call_list.id_mcl', 'call_plan_actual.id_mcl')
                    ->whereIn('call_list.id_peg', $idPegArray)
                    ->where('call_list.segmen', 'Doctor')
                    ->where('call_list.periode', 'like', $periodeLike);
            })
            ->distinct('id_mcl')
            ->count('id_mcl');

        $reachNonDoc = (clone $qNonDoc)
            ->whereNotNull('status')
            ->whereExists(function ($exists) use ($periodeLike, $idPegArray) {
                $exists->select(DB::raw(1))
                    ->from('call_list')
                    ->whereColumn('call_list.id_mcl', 'call_plan_actual.id_mcl')
                    ->whereIn('call_list.id_peg', $idPegArray)
                    ->where('call_list.segmen', 'Non-Doctor')
                    ->where('call_list.periode', 'like', $periodeLike);
            })
            ->distinct('id_mcl')
            ->count();

        //productivity (actual count)
        $prodDoc = (clone $qDoc)
            ->whereNotNull('status')
            ->where('status', '!=', '')
            ->count();

        // Hitung prodNonDoc untuk semua divisi (termasuk Jupiter & Mercury)
        // Tujuan: tampilkan jumlah kunjungan non-dokter secara visual untuk semua divisi
        // Persentase TIDAK terpengaruh — Flutter tetap hanya hitung dokter untuk Jupiter/Mercury
        $prodNonDoc = (clone $qNonDoc)
            ->whereNotNull('status')
            ->where('status', '!=', '')
            // ->where('divisi', 'like', 'NEPTUNE%')
            ->count();

        return response()->json([
            'success' => true,
            'reach_doctor' => $reachDoc,
            'reach_non_doctor' => $reachNonDoc,
            'prod_doctor' => $prodDoc,
            'prod_non_doctor' => $prodNonDoc,
        ]);
    }

    // GET FREQUENCY REPORT - Call Frequency dengan breakdown Doctor & Non-Doctor
    public function getFreqReport(Request $req)
    {
        $idPegList = $req->id_peg;
        $periode   = $req->periode;

        $query = DB::table('call_list as a')
            ->join('data_pegawai as c', 'a.id_peg', '=', 'c.rowid')
            ->join('call_target_class as b', function ($join) {
                $join->on('c.jabatan', '=', 'b.jabatan')
                    ->on('a.class', '=', 'b.class');
            })
            ->where('a.periode', 'like', $periode . '%');
        //  ->where('approval_actual', '=', 'Approve');

        if ($idPegList) {
            $idPegArray = json_decode($idPegList, true);

            if (is_array($idPegArray) && count($idPegArray) > 0) {
                $query->whereIn('a.id_peg', $idPegArray);
            } else {
                // $query->where('id_peg', '0');
                $query->where('a.id_peg', '0');
            }
        }

        $data = $query->select(
            'a.id_peg',
            'a.id_ff',
            'c.jabatan',
            'c.divisi',
            'a.id_mcl',
            'a.nama_dokter',
            'a.segmen',
            'a.class',
            DB::raw('ifnull(a.target_visit,b.target) as target'),

            //  count ONLY approved actuals
            DB::raw("(
                select count(id)
                from call_plan_actual
                where tgl_actual like '{$periode}%'
                and id_peg in (" . implode(',', $idPegArray) . ")
                and id_mcl = a.id_mcl
                and approval_actual = 'Approve' 
            ) as actual"),

            //  point only if approved actual >= target
            DB::raw("case
                when (
                    select count(id)
                    from call_plan_actual
                    where tgl_actual like '{$periode}%'
                    and id_peg in (" . implode(',', $idPegArray) . ")
                    and id_mcl = a.id_mcl
                    and approval_actual = 'Approve'
                ) >= ifnull(a.target_visit,b.target)
                then 1 else 0 end as point")
        )->get();

        // Breakdown: Doctor
        $freqDoctor = $data->filter(function ($item) {
            // Filter: segmen = 'Doctor' DAN point = 1
            return ($item->segmen == 'Doctor' || $item->segmen == 0)
                && $item->point == 1;
        })->count();
        // Breakdown: Non-Doctor
        $freqNonDoctor = $data->filter(function ($item) {
            // Filter: segmen = 'Non-Doctor' DAN point = 1
            return ($item->segmen == 'Non-Doctor' || $item->segmen == 1)
                && $item->point == 1;
        })->count();

        //  Return dengan breakdown
        return response()->json([
            'success' => true,
            'data' => $data,
            // Breakdown untuk tampilan Call Frequency
            'freq_doctor' => $freqDoctor,        // Jumlah doctor yang dapat point
            'freq_non_doctor' => $freqNonDoctor, // Jumlah non-doctor yang dapat point
        ]);
    }


    // ========================================================================
    // GET CALL LIST TARGET - Mendapatkan target call list dari tabel call_target_list
    // Parameter: id_peg (untuk mendapatkan jabatan user), periode (format: YYYY-MM-DD)
    // Membaca target berdasarkan jabatan user yang login
    // ========================================================================
    public function getCallListTarget(Request $req)
    {
        try {
            $idPeg = $req->input('id_peg');
            $periode = $req->input('periode'); // Format: "2026-01-01"

            if (!$idPeg) {
                return response()->json([
                    'success' => false,
                    'message' => 'id_peg is required',
                    'target_dokter' => 0,
                    'target_non_dokter' => 0,
                ]);
            }

            // Decode id_peg jika berbentuk JSON array
            $decoded = json_decode($idPeg, true);
            $pegawaiId = is_array($decoded) && count($decoded) > 0 ? $decoded[0] : $idPeg;

            // Ambil jabatan dan divisi dari data_pegawai berdasarkan id_peg
            $pegawai = DB::table('data_pegawai')
                ->select('jabatan', 'divisi')
                ->where('rowid', $pegawaiId)
                ->first();

            if (!$pegawai) {
                Log::warning('⚠️ GET CALL LIST TARGET - Pegawai not found', ['id_peg' => $pegawaiId]);
                return response()->json([
                    'success' => false,
                    'message' => 'Pegawai not found',
                    'target_dokter' => 0,
                    'target_non_dokter' => 0,
                ]);
            }

            // Query target dari tabel call_target_list-Filter berdasarkan: jabatan, divisi, dan periode (periode_awal <= periode <= periode_akhir)
            $query = DB::table('call_target_list')
                ->where('jabatan', $pegawai->jabatan)
                ->where('divisi', $pegawai->divisi);

            // Filter periode jika diberikan
            if ($periode) {
                $periodeDate = \Carbon\Carbon::parse($periode)->format('Y-m-d');
                $query->where('periode_awal', '<=', $periodeDate)
                    ->where(function ($q) use ($periodeDate) {
                        $q->whereNull('periode_akhir')
                            ->orWhere('periode_akhir', '>=', $periodeDate);
                    });
            }

            $target = $query->first();

            // Return hasil
            return response()->json([
                'success' => true,
                'jabatan' => $pegawai->jabatan,
                'divisi' => $pegawai->divisi,
                'target_dokter' => (int) ($target->dokter ?? 0),
                'target_non_dokter' => (int) ($target->non_dokter ?? 0),
                'target_total' => (int) (($target->dokter ?? 0) + ($target->non_dokter ?? 0)),
            ]);
        } catch (\Exception $e) {
            Log::error('❌ GET CALL LIST TARGET ERROR:', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage(),
                'target_dokter' => 0,
                'target_non_dokter' => 0,
            ], 500);
        }
    }

    // GET WORKING DAYS - Mendapatkan jumlah hari kerja dari database report
    public function getWorkingDays(Request $request)
    {
        // Validasi input
        $year = $request->year;
        $month = $request->month;

        if (!$year || !$month) {
            return response()->json([
                'success' => false,
                'message' => 'Year and month are required',
                'working_days' => 0
            ]);
        }

        // Convert month number to month name (01 -> Jan, 02 -> Feb, dst.)
        $monthNames = [
            '01' => 'Jan',
            '02' => 'Feb',
            '03' => 'Mar',
            '04' => 'Apr',
            '05' => 'May',
            '06' => 'Jun',
            '07' => 'Jul',
            '08' => 'Aug',
            '09' => 'Sep',
            '10' => 'Oct',
            '11' => 'Nov',
            '12' => 'Dec'
        ];

        // Format bulan sesuai database: "Jan-2026", "Feb-2026", dst.
        $monthName = $monthNames[$month] ?? 'Jan';
        $bulanFormatted = $monthName . '-' . $year;
        $bulanFormatteUnvisit = $year . '-' . $monthName;

        // Query database report_admin_mkt.set_param_sum_mcr - Ambil nilai hari_kerja yang sudah berisi total (e.g., 20, 21, 22)
        // Filter: target='Y' untuk data aktif
        $result = DB::table('report_admin_mkt.set_param_sum_mcr')
            ->where('bulan', $bulanFormatted)
            ->where('target', 'Y')
            ->value('hari_kerja');

        $workingDays = (int) ($result ?? 0);

        //  DEBUG: If 0, check if data exists for this period at all
        if ($workingDays == 0) {
            $checkData = DB::table('report_admin_mkt.set_param_sum_mcr')
                ->where('bulan', $bulanFormatted)
                ->count();

            Log::warning("⚠️ GET WORKING DAYS - No working days found! Total rows for period: $checkData");

            if ($checkData > 0) {
                // Ada data tapi tidak ada yang target='Y' dan hari_kerja='Y'
                $targetYCount = DB::table('report_admin_mkt.set_param_sum_mcr')
                    ->where('bulan', $bulanFormatteUnvisit)
                    ->where('target', 'Y')
                    ->count();

                $hariKerjaYCount = DB::table('report_admin_mkt.set_param_sum_mcr')
                    ->where('bulan', $bulanFormatteUnvisit)
                    ->where('hari_kerja', 'Y')
                    ->count();

                Log::warning("⚠️ GET WORKING DAYS - Data exists but: target=Y rows=$targetYCount, hari_kerja=Y rows=$hariKerjaYCount");
            } else {
                Log::warning("⚠️ GET WORKING DAYS - No data exists for period: $bulanFormatted");

                // DEBUG: Show available periods in database
                $availablePeriods = DB::table('report_admin_mkt.set_param_sum_mcr')
                    ->select('bulan')
                    ->distinct()
                    ->orderBy('bulan', 'desc')
                    ->limit(10)
                    ->pluck('bulan')
                    ->toArray();

                Log::warning("🔍 Available periods in database: " . json_encode($availablePeriods));
            }
        }

        // Hitung jumlah unvisit untuk id_peg ini
        // sehingga effective_working_days = working_days - unvisit_count
        // id_peg bersifat opsional — jika tidak dikirim, effective_working_days == working_days
        $idPeg        = $request->id_peg;
        $unvisitCount = 0;

        if ($idPeg) {
            // Format periode: 'yyyy-MM-01'
            $periodeFormatted2 = $year . '-' . str_pad($month, 2, '0', STR_PAD_LEFT) . '-01';

            $countMr = DB::table('visit_tidak_kunjungan_mr')
                ->where('id_peg', $idPeg)
                ->where('periode', $periodeFormatted2)
                ->count();

            $countNonMr = DB::table('visit_tidak_kunjungan')
                ->where('id_peg', $idPeg)
                ->where('periode', $periodeFormatted2)
                ->count();

            $unvisitCount = $countMr + $countNonMr;
        }

        $effectiveWorkingDays = max(0, $workingDays - $unvisitCount);

        // Return hasil
        $response = [
            'success'               => true,
            'working_days'          => $workingDays,
           //tambahan field untuk unvisit deduction
            'unvisit_count'         => $unvisitCount,
            'effective_working_days' => $effectiveWorkingDays,
            'period' => $bulanFormatted,
            // DEBUG info ke response
            'debug' => [
                'input_year' => $year,
                'input_month' => $month,
                'formatted_period' => $bulanFormatted,
            ]
        ];

        // DEBUG: Jika 0, tambahkan available periods ke response
        if ($workingDays == 0) {
            $availablePeriods = DB::table('report_admin_mkt.set_param_sum_mcr')
                ->select('bulan')
                ->distinct()
                ->orderBy('bulan', 'desc')
                ->limit(10)
                ->pluck('bulan')
                ->toArray();

            $response['debug']['available_periods'] = $availablePeriods;
            $response['debug']['note'] = 'No working days found. Check if period format matches database.';
        }

        return response()->json($response);
    }

    // ========================================================================
    // GET PRODUCTIVITY TARGET — target Call Productivity dari tabel call_target_hari
    // Parameter: id_peg, year, month
    // Logic:
    //   1. Ambil jabatan & divisi dari data_pegawai
    //   2. Cari target per hari (dokter + non_dokter) dari call_target_hari
    //   3. Hitung effective_working_days = working_days - unvisit_count
    //   4. Return target_dokter = dokter_per_day × eff_days
    //             target_non_dokter = non_dokter_per_day × eff_days
    // ========================================================================
    public function getProductivityTarget(Request $req)
    {
        $idPeg = $req->input('id_peg');
        $year  = $req->input('year');
        $month = $req->input('month');

        if (!$idPeg || !$year || !$month) {
            return response()->json([
                'success' => false,
                'message' => 'id_peg, year, month are required',
            ], 422);
        }

        try {
            // 1. Jabatan & divisi user
            $pegawai = DB::table('data_pegawai')
                ->select('jabatan', 'divisi')
                ->where('rowid', $idPeg)
                ->first();

            if (!$pegawai) {
                return response()->json([
                    'success' => false,
                    'message' => 'Pegawai not found',
                ], 404);
            }

            // 2. Format periode
            $monthPad       = str_pad($month, 2, '0', STR_PAD_LEFT);
            $periodeStr     = $year . '-' . $monthPad . '-01'; // yyyy-MM-01
            $periodeStrUnvisit     = $monthPad . '-' . $year; // yyyy-MM-01

            // 3. Target per hari dari call_target_hari
            //    Filter: jabatan, divisi, periode_awal <= periodeStr,
            //            periode_akhir IS NULL OR periode_akhir >= periodeStr
            $targetHari = DB::table('call_target_hari')
                ->where('jabatan', $pegawai->jabatan)
                ->where('divisi',  $pegawai->divisi)
                ->where(DB::raw('DATE(periode_awal)'), '<=', $periodeStr)
                ->where(function ($q) use ($periodeStr) {
                    $q->whereNull('periode_akhir')
                        ->orWhere(DB::raw('DATE(periode_akhir)'), '>=', $periodeStr);
                })
                ->orderBy('periode_awal', 'desc')
                ->first();

            $dokterPerDay    = (int) ($targetHari->dokter     ?? 0);
            $nonDokterPerDay = (int) ($targetHari->non_dokter ?? 0);

            // 4. Hari kerja dari set_param_sum_mcr
            $monthNames = [
                '01' => 'Jan',
                '02' => 'Feb',
                '03' => 'Mar',
                '04' => 'Apr',
                '05' => 'May',
                '06' => 'Jun',
                '07' => 'Jul',
                '08' => 'Aug',
                '09' => 'Sep',
                '10' => 'Oct',
                '11' => 'Nov',
                '12' => 'Dec',
            ];
            $bulanFormatted = ($monthNames[$monthPad] ?? 'Jan') . '-' . $year;

            $workingDays = (int) (DB::table('report_admin_mkt.set_param_sum_mcr')
                ->where('bulan',  $bulanFormatted)
                ->where('target', 'Y')
                ->value('hari_kerja') ?? 0);

            // 5. Kurangi unvisit
            $unvisitMr    = DB::table('visit_tidak_kunjungan_mr')
                ->where('id_peg',  $idPeg)
                ->where('periode', $periodeStrUnvisit)
                ->count();
            $unvisitNonMr = DB::table('visit_tidak_kunjungan')
                ->where('id_peg',  $idPeg)
                ->where('periode', $periodeStrUnvisit)
                ->count();
            $unvisitCount  = $unvisitMr + $unvisitNonMr;
            $effectiveDays = max(0, $workingDays - $unvisitCount);

            return response()->json([
                'success'                  => true,
                'jabatan'                  => $pegawai->jabatan,
                'divisi'                   => $pegawai->divisi,
                'target_per_day_dokter'    => $dokterPerDay,
                'target_per_day_non_dokter' => $nonDokterPerDay,
                'working_days'             => $workingDays,
                'unvisit_count'            => $unvisitCount,
                'effective_working_days'   => $effectiveDays,
                'target_dokter'            => $dokterPerDay    * $effectiveDays,
                'target_non_dokter'        => $nonDokterPerDay * $effectiveDays,
                'target_total'             => ($dokterPerDay + $nonDokterPerDay) * $effectiveDays,
            ]);

        } catch (\Exception $e) {
            Log::error('❌ GET PRODUCTIVITY TARGET ERROR', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage(),
            ], 500);
        }
    }

    //mcl offline
    public function offlineMCL(Request $req)
    {
        $idPegList = $req->input('id_peg');
        $search = trim($req->search ?? '');

        $query = DB::table('list_dokter_visit_new')
            ->select(
                DB::raw('MIN(id_mcl) as id_mcl'),
                'nama_dokter',
                'institusi'
            )
            ->groupBy('nama_dokter', 'institusi');

        if ($idPegList) {
            $idPegArray = json_decode($idPegList, true);

            if (is_array($idPegArray) && count($idPegArray) > 0) {

                $struktur = DB::table('struktur')
                    ->select(DB::raw('group_concat(distinct id_peg_mr) as id_peg'))
                    ->whereRaw('"' . date('Y-m-d') . '" between periode_awal and periode_akhir')
                    ->where(function ($q) use ($idPegArray) {
                        $q->whereIn('id_peg_dm', $idPegArray)
                            ->orWhereIn('id_peg_rsm', $idPegArray);
                    })
                    ->first();

                $query->where(function ($q) use ($idPegArray, $struktur) {
                    $q->whereIn('id_peg', $idPegArray);

                    if (!empty($struktur->id_peg)) {
                        $q->orWhereIn('id_peg', explode(',', $struktur->id_peg));
                    }
                });
            } else {
                $query->where('id_peg', '0');
            }
        }

        return response()->json([
            'success' => true,
            'data' => $query->get(),
        ]);
    }


    //call list offline
    public function offlineCallList(Request $req)
    {
        $idPegList = $req->input('id_peg');

        $query = DB::table('call_list as cl')
            ->leftJoin('list_dokter_visit_new as m', 'cl.id_mcl', '=', 'm.id_mcl')
            ->select(
                'cl.*',
                DB::raw('MIN(m.institusi) as institusi')
            )
            ->where('cl.approval', 'Approve');

        if ($idPegList) {
            $idPegArray = json_decode($idPegList, true);

            if (is_array($idPegArray) && count($idPegArray) > 0) {
                $query->whereIn('cl.id_peg', $idPegArray);
            } else {
                $query->where('cl.id_peg', '0');
            }
        }

        if ($req->monthYear) {
            $query->where('cl.periode', 'LIKE', "{$req->monthYear}%");
        }

        $data = $query
            ->groupBy('cl.id') // IMPORTANT
            ->get();

        return response()->json([
            'data' => $data
        ]);
    }


    //call plan offline
    public function offlineCallPlan(Request $req)
    {
        $idPegList = $req->input('id_peg');

        $query = DB::table('call_plan_actual')
            ->where('approval', 'Approve')
            ->whereNull('tgl_actual');

        if ($idPegList) {
            $idPegArray = json_decode($idPegList, true);

            if (is_array($idPegArray) && count($idPegArray) > 0) {
                $query->whereIn('id_peg', $idPegArray);
            } else {
                $query->where('id_peg', '0');
            }
        }

        if ($req->monthYear) {
            $query->where('tgl_plan', 'LIKE', "{$req->monthYear}%");
        }

        if ($req->dateSearch) {
            $query->where('tgl_plan', $req->dateSearch);
        }

        if ($req->search) {
            $search = $req->search;

            $query->where(function ($q) use ($search) {
                $q->where('nama_dokter', 'LIKE', "%$search%")
                    ->orWhere('institusi', 'LIKE', "%$search%");
            });
        }

        $data = $query->get();

        return response()->json([
            'data' => $data
        ]);
    }

    //  Ambil versi terbaru dari tabel call_version - Digunakan oleh Flutter app untuk cek apakah perlu update
    // Endpoint: GET /api/app-version
    public function getAppVersion()
    {
        // Ambil baris terakhir (versi terbaru berdasarkan id terbesar)
        $versionData = DB::table('call_version')
            ->select('version', 'link_apk')
            ->orderBy('id', 'desc')
            ->first();

        if (!$versionData) {
            return response()->json([
                'success' => false,
                'message' => 'Data versi tidak ditemukan di database.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'version'  => $versionData->version,
                'link_apk' => $versionData->link_apk,
            ],
        ]);
    }

    public function callJoinVisit(Request $req)
    {
        $idPegList = $req->input('id_peg');
        $getjabatan = DB::table('data_pegawai')->select(DB::raw('group_concat(distinct jabatan) as jabatan'))->whereIn('rowid', $idPegList)->first();

        if (str_contains($getjabatan->jabatan, 'ACT. DM') || str_contains($getjabatan->jabatan, 'DM')) {
            $struktur = DB::table('struktur')->whereIn('id_peg_dm', $idPegList)->first();

            if (!$struktur) {
                return response()->json(['message' => 'DM not found'], 404);
            }

            $atasan = DB::table('data_pegawai')->where('rowid', $struktur->id_peg_rsm)->select('rowid', 'nama')->first();

            return response()->json([
                'role' => 'DM',
                'atasan' => $atasan
            ]);
        } else {
            $struktur = DB::table('struktur')->whereIn('id_peg_mr', $idPegList)->first();

            if (!$struktur) {
                return response()->json(['message' => 'MR not found'], 404);
            }

            $atasan = DB::table('data_pegawai')
                ->whereIn('rowid', [
                    $struktur->id_peg_dm,
                    $struktur->id_peg_rsm
                ])
                ->select('rowid', 'nama')
                ->get();

            return response()->json([
                'role' => 'MR',
                'atasan' => $atasan
            ]);
        }
    }

    // UNVISIT — Izin Tidak Ada Kunjungan
    private function _unvisitDateConfig(): array
    {
        return [
            'days_back'    => 15,  // maks. hari ke belakang dari hari ini
            'days_forward' => 30, // maks. hari ke depan dari hari ini
        ];
    }

    // Mengembalikan konfigurasi batas waktu pengisian unvisit ke Dart.
    public function getUnvisitConfig()
    {
        $config = $this->_unvisitDateConfig();
        return response()->json(['success' => true, 'config' => $config]);
    }

    // Mengembalikan daftar pilihan alasan unvisit.
    public function getUnvisitAlasan()
    {
        $alasan = [
            ['value' => 'sakit',              'label' => 'Sakit'],
            ['value' => 'izin_tidak_masuk',   'label' => 'Izin Tidak Masuk'],
            ['value' => 'cuti',               'label' => 'Cuti'],
            ['value' => 'administrasi',       'label' => 'Administrasi'],
            ['value' => 'event',              'label' => 'Event'],
            ['value' => 'meeting',            'label' => 'Meeting'],
            ['value' => 'training',           'label' => 'Training'],
            ['value' => 'belum_aktif_bekerja','label' => 'Belum Aktif Bekerja'],
            ['value' => 'other',              'label' => 'Other'],
        ];

        return response()->json(['success' => true, 'data' => $alasan]);
    }

    /**
     * POST /add-unvisit
     * Menyimpan data unvisit ke tabel yang sesuai berdasarkan jabatan:
     *   - MR / PS / KAE  → visit_tidak_kunjungan_mr
     *   - Selain itu     → visit_tidak_kunjungan
     */
    public function addUnvisit(Request $req)
    {
        $idPeg    = $req->input('id_peg');
        $idFf     = $req->input('id_ff', '');
        $nama     = $req->input('nama', '');
        $jabatan  = $req->input('jabatan', '');
        $divisi   = $req->input('divisi', '');
        $periode  = $req->input('periode');   // format: yyyy-MM-01
        $tanggal  = $req->input('tanggal');   // format: yyyy-MM-dd
        $alasan   = $req->input('alasan');
        $keterangan = $req->input('keterangan', '');

        // Validasi field wajib
        if (!$idPeg || !$periode || !$tanggal || !$alasan) {
            return response()->json([
                'success' => false,
                'message' => 'Field id_peg, periode, tanggal, dan alasan wajib diisi.'
            ], 422);
        }

        // Validasi range tanggal — nilai diambil dari _unvisitDateConfig() agar sinkron dengan getUnvisitConfig
        $dateConfig = $this->_unvisitDateConfig();
        $minDate = date('Y-m-d', strtotime('-' . $dateConfig['days_back']    . ' days'));
        $maxDate = date('Y-m-d', strtotime('+' . $dateConfig['days_forward'] . ' days'));
        if ($tanggal < $minDate) {
            return response()->json([
                'success' => false,
                'message' => 'Tanggal tidak boleh lebih dari ' . $dateConfig['days_back'] . ' hari ke belakang dari hari ini.'
            ], 422);
        }
        if ($tanggal > $maxDate) {
            return response()->json([
                'success' => false,
                'message' => 'Tanggal tidak boleh lebih dari ' . $dateConfig['days_forward'] . ' hari ke depan dari hari ini.'
            ], 422);
        }

        // Hitung week dari tanggal
        $week = 'W' . date('W', strtotime($tanggal));

        $isMrGroup = in_array(strtoupper(trim($jabatan)), ['MR', 'PS', 'KAE']);
        $table     = $isMrGroup ? 'visit_tidak_kunjungan_mr' : 'visit_tidak_kunjungan';

        // Cek duplikasi (id_peg + tanggal)
        $exists = DB::table($table)
            ->where('id_peg', $idPeg)
            ->where('tanggal', $tanggal)
            ->exists();

        if ($exists) {
            return response()->json([
                'success' => false,
                'message' => 'Data unvisit untuk tanggal tersebut sudah ada.'
            ], 409);
        }

        DB::table($table)->insert([
            'periode'    => date('m-Y', strtotime($periode)),
            'week'       => $week,
            'id_peg'     => $idPeg,
            'id_ff'      => $idFf,
            'nama'       => $nama,
            'divisi'     => $divisi,
            'tanggal'    => $tanggal,
            'alasan'     => $alasan,
            'keterangan' => $keterangan,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Data unvisit berhasil disimpan.',
            'table'   => $table,
        ]);
    }

    // POST /get-unvisit-list-  Mengambil list unvisit berdasarkan id_peg (array JSON) dan periode.
    public function getUnvisitList(Request $req)
    {
        $idPegJson = $req->input('id_peg');
        $periode   = date('m-Y', strtotime($req->input('periode')));

        $idPegArray = [];
        if ($idPegJson) {
            $decoded = json_decode($idPegJson, true);
            if (is_array($decoded)) {
                $idPegArray = $decoded;
            }
        }

        if (empty($idPegArray)) {
            return response()->json(['success' => false, 'data' => []]);
        }

        // Gabungkan dari kedua tabel
        $mr = DB::table('visit_tidak_kunjungan_mr')
            ->whereIn('id_peg', $idPegArray)
            ->when($periode, fn($q) => $q->where('periode', $periode))
            ->select('id', DB::raw('concat(substr(periode,4,4),"-",substr(periode,1,2),"-01") as periode'), 'week', 'id_peg', 'id_ff', 'nama', 'divisi', 'tanggal', 'alasan', 'keterangan')
            ->get();

        $nonMr = DB::table('visit_tidak_kunjungan')
            ->whereIn('id_peg', $idPegArray)
            ->when($periode, fn($q) => $q->where('periode', $periode))
            ->select('id', DB::raw('concat(substr(periode,4,4),"-",substr(periode,1,2),"-01") as periode'), 'week', 'id_peg', 'id_ff', 'nama', 'divisi', 'tanggal', 'alasan', 'keterangan')
            ->get();

        $merged = $mr->concat($nonMr)->sortBy('tanggal')->values();

        return response()->json(['success' => true, 'data' => $merged]);
    }

    // POST /delete-unvisit - Menghapus data unvisit berdasarkan id
    public function deleteUnvisit(Request $req)
    {
        $id = $req->input('id');

        if (!$id) {
            return response()->json([
                'success' => false,
                'message' => 'ID tidak ditemukan.'
            ], 422);
        }

        $deletedMr    = DB::table('visit_tidak_kunjungan_mr')->where('id', $id)->delete();
        $deletedNonMr = 0;
        if (!$deletedMr) {
            $deletedNonMr = DB::table('visit_tidak_kunjungan')->where('id', $id)->delete();
        }

        if ($deletedMr || $deletedNonMr) {
            return response()->json([
                'success' => true,
                'message' => 'Data unvisit berhasil dihapus.'
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Data tidak ditemukan atau sudah dihapus.'
        ], 404);
    }

    // UPDATE CALL LIST (DENGAN AUDIT TRAIL) - Hanya bisa edit jika status = Pending atau Reject
    public function updateCallList(Request $req)
    {
        $v = $this->checkAppVersion($req); if ($v) return $v;
        date_default_timezone_set('Asia/Jakarta');
        
        $validated = $req->validate([
            'call_list_id' => 'required|exists:call_list,id',
            'id_mcl'       => 'required',
            'periode'      => 'required|date',
        ]);
        
        // CEK STATUS - Hanya bisa edit jika Pending atau Reject
        $callList = DB::table('call_list')
            ->where('id', $req->call_list_id)
            ->first();
        
        if (!$callList) {
            return response()->json([
                'success' => false,
                'message' => 'Call list not found.'
            ], 404);
        }
        
        $approval = $callList->approval ?? '-';
        // Hanya bisa edit jika status Reject
        if ($approval !== 'Reject') {
            return response()->json([
                'success' => false,
                'message' => 'Cannot edit! Only Rejected call list can be edited. Current status: ' . $approval
            ], 403);
        }
        
        // VALIDASI PERIODE & TARGET (sama seperti saveCallList)
        $pegawai = DB::table('data_pegawai')
            ->select('jabatan', 'divisi')
            ->where('rowid', $req->id_peg)
            ->first();
        
        if ($pegawai) {
            $target = DB::table('call_target_list')
                ->where('jabatan', $pegawai->jabatan)
                ->where('divisi', $pegawai->divisi)
                ->where('periode_awal', '<=', $req->periode)
                ->where(function ($q) use ($req) {
                    $q->whereNull('periode_akhir')
                        ->orWhere('periode_akhir', '>=', $req->periode);
                })
                ->first();
            
            // Jika dokter berubah, cek target
            if ($target && $req->id_mcl != $callList->id_mcl) {
                $segmen = $req->segmen ?? 'Doctor';
                
                if ($segmen === 'Doctor') {
                    $countDokter = DB::table('call_list')
                        ->where('id_peg', $req->id_peg)
                        ->where('periode', $req->periode)
                        ->where('segmen', 'Doctor')
                        ->where('id', '!=', $req->call_list_id) // Exclude item saat ini
                        ->count();
                    
                    if ($countDokter >= $target->dokter) {
                        return response()->json([
                            'success' => false,
                            'message' => "Target Dokter sudah penuh.",
                        ], 400);
                    }
                }
            }
        }
        
        // TRACK PERUBAHAN
        $oldData = $callList;
        $changes = [];
        
        // Cek field mana yang berubah
        $fieldsToTrack = ['id_mcl', 'nama_dokter', 'spec', 'segmen', 'class', 'id_peg', 'id_ff'];
        
        foreach ($fieldsToTrack as $field) {
            $oldValue = $oldData->$field ?? null;
            $newValue = $req->$field ?? null;
            
            if ($oldValue != $newValue) {
                $changes[$field] = [
                    'old' => $oldValue,
                    'new' => $newValue
                ];
            }
        }
        
        // UPDATE CALL_LIST
        try {
            DB::table('call_list')
                ->where('id', $req->call_list_id)
                ->update([
                    'id_mcl'       => $req->id_mcl,
                    'nama_dokter'  => $req->nama_dokter,
                    'spec'         => $req->spec,
                    'segmen'       => $req->segmen,
                    'class'        => $req->class,
                    'id_peg'       => $req->id_peg,
                    'id_ff'        => $req->id_ff,
                    // Reset approval ke NULL setelah edit
                    // supaya DM bisa re-approve data yang sudah diperbaiki
                    'approval'     => null,
                    'approval_by'      => null,
                    'approval_date'    => null,
                    'approval_comment' => null,
                    'updated_by'   => $req->id_peg,
                    'updated_date' => date('Y-m-d H:i:s'),
                ]);

            // Insert SATU baris per sesi edit — lebih mudah di-track di DB
            DB::table('call_list_history')->insert([
                'call_list_id'    => $req->call_list_id,
                'id_peg'          => $req->id_peg,
                'action_type'     => 'edit',
                'action_date'     => date('Y-m-d H:i:s'),
                'old_id_mcl'      => $oldData->id_mcl,
                'new_id_mcl'      => $req->id_mcl,
                'old_nama_dokter' => $oldData->nama_dokter,
                'new_nama_dokter' => $req->nama_dokter,
                'old_spec'        => $oldData->spec,
                'new_spec'        => $req->spec,
                'old_class'       => $oldData->class,
                'new_class'       => $req->class,
                'old_segmen'        => $oldData->segmen,
                'new_segmen'        => $req->segmen,
                'old_wilayah'       => $oldData->wilayah,
                'new_wilayah'       => $req->wilayah,
                'old_target_visit'  => $oldData->target_visit,
                'new_target_visit'  => $req->target_visit,
                'reason'          => $req->reason ?? null,
                'ip_address'      => $req->ip(),
            ]);
            return response()->json([
                'success' => true,
                'message' => 'Call list updated successfully.',
                'changes' => count($changes)
            ]);
        } catch (\Exception $e) {
            Log::error('Update Call List Error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to update call list.'
            ], 500);
        }
    }

    // GET CALL LIST HISTORY (AUDIT TRAIL)
    public function getCallListHistory(Request $req)
    {
        try {
            $callListId = $req->input('call_list_id');

            $mapItem = function ($item) {
                return [
                    'id'               => $item->id,
                    'action_type'      => $item->action_type,
                    'action_date'      => $item->action_date,
                    'old_id_mcl'       => $item->old_id_mcl,
                    'new_id_mcl'       => $item->new_id_mcl,
                    'old_nama_dokter'  => $item->old_nama_dokter,
                    'new_nama_dokter'  => $item->new_nama_dokter,
                    'old_spec'         => $item->old_spec,
                    'new_spec'         => $item->new_spec,
                    'old_class'        => $item->old_class,
                    'new_class'        => $item->new_class,
                    'old_segmen'       => $item->old_segmen,
                    'new_segmen'       => $item->new_segmen,
                    'old_wilayah'      => $item->old_wilayah,
                    'new_wilayah'      => $item->new_wilayah,
                    'old_target_visit' => $item->old_target_visit,
                    'new_target_visit' => $item->new_target_visit,
                    'reason'           => $item->reason,
                ];
            };

            // Coba exact match dulu berdasarkan call_list_id
            $history = DB::table('call_list_history')
                ->where('call_list_id', $callListId)
                ->orderBy('action_date', 'desc')
                ->get();

            // Fallback: jika tidak ada, cari berdasarkan id_peg + id_mcl + bulan yang sama.
            // Ini terjadi ketika call_list record lama dihapus & dibuat ulang (ID berubah),
            // sehingga call_list_history.call_list_id tidak cocok dengan call_list.id yang baru.
            if ($history->isEmpty()) {
                $callList = DB::table('call_list')->where('id', $callListId)->first();
                if ($callList) {
                    $periode = \Carbon\Carbon::parse($callList->periode);
                    $history = DB::table('call_list_history')
                        ->where('id_peg', $callList->id_peg)
                        ->where(function ($q) use ($callList) {
                            $q->where('old_id_mcl', $callList->id_mcl)
                              ->orWhere('new_id_mcl', $callList->id_mcl);
                        })
                        ->whereYear('action_date', $periode->year)
                        ->whereMonth('action_date', $periode->month)
                        ->orderBy('action_date', 'desc')
                        ->get();
                }
            }

            return response()->json([
                'success' => true,
                // 'data'    => $history
                'data'    => $history->map($mapItem),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error fetching history.'
            ], 500);
        }
    }

    // NOTIFIKASI — Jumlah call list milik user yang masih pending approval (approval IS NULL)
    public function getMyPendingCallListCount(Request $req)
    {
        $idPegList = array_map('intval', $req->input('id_peg', []));
        $month     = (int) $req->input('month');
        $year      = (int) $req->input('year');

        if (empty($idPegList) || !$month || !$year) {
            return response()->json([
                'success' => false,
                'message' => 'id_peg, month, year required'
            ], 400);
        }

        $startDate = sprintf('%04d-%02d-01', $year, $month);
        $endDate   = date('Y-m-t', strtotime($startDate));

        // Hitung call list milik user yang approval-nya masih NULL (belum di-approve DM)
        $pendingCount = DB::table('call_list')
            ->whereIn('id_peg', $idPegList)
            ->whereNull('approval')
            ->whereBetween('periode', [$startDate, $endDate])
            ->count();

        return response()->json([
            'success' => true,
            'data'    => ['my_pending_count' => $pendingCount]
        ]);
    }
}