<?php

namespace App\Http\Controllers\Api;

use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Models\list_dokter_visit;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache; // optimasi cache notifikasi (DmApprovalNotificationSummary)

// class VisitApprovalController extends Controller      
class VisitApprovalController_dev extends Controller   
{
    // ============================================================================
    // KONFIGURASI BATAS WAKTU APPROVAL
    // BATAS_JAM_APPROVAL   : jam batas approval call plan & call actual (format 24 jam WIB)
    //                        Contoh: 10 = harus selesai sebelum 10:00 WIB
    //                        Set ke null untuk menonaktifkan validasi ini
    //
    // BATAS_HARI_KERJA     : hari kerja awal bulan untuk approval & add call list
    //                        Contoh: 5 = hanya boleh sampai hari kerja ke-5 tiap bulan
    //                        Set ke null untuk menonaktifkan validasi ini
    //
    // OVERRIDE_BULAN       : skip validasi hari kerja untuk bulan tertentu
    //                        Format: 'YYYY-MM' (contoh: '2026-04')
    //                        Kosongkan string ('') jika tidak ada override
    // ============================================================================

    // CEK VERSI APLIKASI — dipanggil di awal setiap fungsi save/submit
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

    // --- CALL LIST ---
    const BATAS_HARI_KERJA_LIST = 30;  
    
    const OVERRIDE_BULAN_LIST   = ''; // Isi format 'YYYY-MM' (contoh: '2026-04') untuk skip validasi pada bulan itu => Kosongkan ('') jika tidak ada override.

    // --- CALL PLAN ---
    const BATAS_JAM_PLAN        = 23;// Batas jam approval call plan di hari yang sama dengan tgl_plan (format 24 jam WIB).

    // --- CALL ACTUAL ---
    const BATAS_HARI_ACTUAL     = 4;
    // Batas jam pada hari terakhir yang diizinkan (hari ke-BATAS_HARI_ACTUAL setelah tgl_actual).
    // Contoh: tgl_actual=1 Apr → batas = 2 Apr sebelum jam 10:00 WIB.
    // Set ke null untuk nonaktifkan batas jam (boleh kapan saja di hari terakhir).
    const BATAS_JAM_ACTUAL      = 23;   // ← ubah angka jika perlu

    // --- NOTIFIKASI REMINDER ---
    const NOTIFICATION_INTERVAL_MINUTES = 1; //Untuk setting notifikasi reminder, Ubah sesuai kebutuhan.


    /**
     * Hitung tanggal hari kerja ke-N dari periodeAwal.
     * Sabtu & Minggu tidak dihitung.
     * Contoh: periodeAwal = 1 Apr (Jumat), n=5 → return 7 Apr (Kamis)
     */
    private function hitungDeadlineHariKerja(Carbon $periodeAwal, int $n): Carbon
    {
        $count   = 0;
        $tanggal = $periodeAwal->copy()->startOfDay();
        while (true) {
            if ($tanggal->isWeekday()) {
                $count++;
                if ($count >= $n) break;
            }
            $tanggal->addDay();
        }
        return $tanggal;
    }

    /**
     * Cek apakah sudah melewati batas jam tertentu (WIB) hari ini.
     */
    private function sudahLewatJam(int $batasJam): bool
    {
        $now = Carbon::now('Asia/Jakarta');
        return ($now->hour > $batasJam || ($now->hour === $batasJam && $now->minute > 0));
    }

    // APPROVAL CALL LIST 
    public function DmApprovalListName(Request $req)
    {
        $idPegList = array_map('intval', $req->input('id_peg', []));
        $month = (int) $req->input('month');
        $year  = (int) $req->input('year');

        if (empty($idPegList)) {
            return response()->json([
                'success' => false,
                'message' => 'id_peg is required'
            ], 400);
        }

        if (!$month || !$year) {
            return response()->json([
                'success' => false,
                'message' => 'month and year are required'
            ], 400);
        }

        // Build date range for the month
        $startDate = sprintf('%04d-%02d-01', $year, $month);
        $endDate   = date('Y-m-t', strtotime($startDate)); // last day of month
        $monthyear   = date('Y-m-d');

        // [CONFIG] FILTER: jika deadline 5 hari kerja bulan ini sudah lewat,
        $cekpegawai = DB::table('call_setting as a')->join('data_pegawai as b', function ($join) {
            $join->on('a.user', '=', 'b.id_user');
        })->select('b.rowid', 'a.jumlah')->whereIn('b.rowid', $idPegList)->where('a.input_set', 'Approval Call List')->first();

        if (self::BATAS_HARI_KERJA_LIST !== null && empty($cekpegawai->rowid)) {
            $bulanPeriode = sprintf('%04d-%02d', $year, $month);
            if (empty(self::OVERRIDE_BULAN_LIST) || trim(self::OVERRIDE_BULAN_LIST) !== $bulanPeriode) {
                $periodeAwal = Carbon::createFromFormat('Y-m-d', $startDate, 'Asia/Jakarta');
                $deadlineCL  = $this->hitungDeadlineHariKerja($periodeAwal, self::BATAS_HARI_KERJA_LIST);
                if (Carbon::now('Asia/Jakarta')->startOfDay()->gt($deadlineCL->startOfDay())) {
                    return response()->json(['success' => true, 'data' => []]);
                }
            }
        } else {
            $bulanPeriode = sprintf('%04d-%02d', $year, $month);
            if (empty(self::OVERRIDE_BULAN_LIST) || trim(self::OVERRIDE_BULAN_LIST) !== $bulanPeriode) {
                $periodeAwal = Carbon::createFromFormat('Y-m-d', $startDate, 'Asia/Jakarta');
                $deadlineCL  = $this->hitungDeadlineHariKerja($periodeAwal, $cekpegawai->jumlah);
                if (Carbon::now('Asia/Jakarta')->startOfDay()->gt($deadlineCL->startOfDay())) {
                    return response()->json(['success' => true, 'data' => []]);
                }
            }
        }

        $getjabatan = DB::table('data_pegawai')->select(DB::raw('group_concat(distinct jabatan) as jabatan'), DB::raw('group_concat(distinct divisi) as divisi'))->whereIn('rowid', $idPegList)->first();

        if ((str_contains($getjabatan->jabatan, 'ACT. DM') || str_contains($getjabatan->jabatan, 'DM')) && !str_contains($getjabatan->jabatan, 'DMD')) {
            $employees = DB::table('call_list as cl')
                ->join('data_pegawai as dp', 'dp.rowid', '=', 'cl.id_peg')
                ->join('struktur as s', function ($join) {
                    $join->on('s.id_peg_mr', '=', 'cl.id_peg')
                        ->orOn('s.id_peg_dm', '=', 'cl.id_peg');
                })
                ->leftJoin('data_pegawai as rsm', 'rsm.rowid', '=', 's.id_peg_rsm')
                ->leftJoin('data_pegawai as mm', 'mm.rowid', '=', 's.id_peg_mm')
                // ->where('s.periode_akhir', $monthyear)
                ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                ->whereIn('s.id_peg_dm', $idPegList)
                ->whereNull('cl.approval')
                ->whereBetween('cl.periode', [$startDate, $endDate])

                ->where(function ($q) {
                    $q->whereColumn('cl.id_peg', 's.id_peg_mr')
                        ->orWhere(function ($q2) {
                            $q2->whereColumn('cl.id_peg', 's.id_peg_dm')
                                ->whereIn('rsm.status', ['Vacant', 'Dummy'])
                                ->whereIn('mm.status', ['Vacant', 'Dummy']);
                        });
                })
                ->select(
                    'dp.rowid as id_peg',
                    'dp.nama as nama_pegawai',
                    DB::raw('COUNT(DISTINCT cl.id) as total_request')
                )
                ->groupBy('dp.rowid', 'dp.nama')
                ->orderBy('dp.nama')
                ->get();
        } else if (str_contains($getjabatan->jabatan, 'RSM')) {
            $employees = DB::table('call_list as cl')
                ->join('data_pegawai as dp', 'dp.rowid', '=', 'cl.id_peg')

                ->join('struktur as s', function ($join) {
                    $join->on('s.id_peg_dm', '=', 'cl.id_peg')
                        ->orOn('s.id_peg_mr', '=', 'cl.id_peg')
                        ->orOn('s.id_peg_rsm', '=', 'cl.id_peg');
                })

                ->leftJoin('data_pegawai as dm', 'dm.rowid', '=', 's.id_peg_dm')
                ->leftJoin('data_pegawai as mm', 'mm.rowid', '=', 's.id_peg_mm')

                // ->where('s.periode_akhir', $monthyear)
                ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                ->whereIn('s.id_peg_rsm', $idPegList)
                ->whereNull('cl.approval')
                ->whereBetween('cl.periode', [$startDate, $endDate])

                ->where(function ($q) {
                    $q->whereColumn('cl.id_peg', 's.id_peg_dm')
                        ->orWhere(function ($q2) {
                            $q2->whereColumn('cl.id_peg', 's.id_peg_mr')
                                ->whereIn('dm.status', ['Vacant', 'Dummy']);
                        })
                        ->orWhere(function ($q3) {
                            $q3->whereColumn('cl.id_peg', 's.id_peg_rsm')
                                ->whereIn('mm.status', ['Vacant', 'Dummy']);
                        });
                })

                ->select(
                    'dp.rowid as id_peg',
                    'dp.nama as nama_pegawai',
                    DB::raw('COUNT(DISTINCT cl.id) as total_request')
                )

                ->groupBy('dp.rowid', 'dp.nama')
                ->orderBy('dp.nama')
                ->get();
        } else if (str_contains($getjabatan->jabatan, 'MM')) {
            $employees = DB::table('call_list as cl')
                ->join('data_pegawai as dp', 'dp.rowid', '=', 'cl.id_peg')

                ->join('struktur as s', function ($join) {
                    $join->on(function ($q) {
                        $q->on('s.id_peg_dm', '=', 'cl.id_peg')
                            ->orOn('s.id_peg_mr', '=', 'cl.id_peg')
                            ->orOn('s.id_peg_rsm', '=', 'cl.id_peg');
                    });
                })

                ->leftJoin('data_pegawai as dm', 'dm.rowid', '=', 's.id_peg_dm')

                ->leftJoin('data_pegawai as rsm', 'rsm.rowid', '=', 's.id_peg_rsm')

                // ->where('s.periode_akhir', $monthyear)
                ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                ->whereIn('s.id_peg_mm', $idPegList)
                ->whereNull('cl.approval')
                ->whereBetween('cl.periode', [$startDate, $endDate])

                // filter: DM/RSM vacant/dummy
                ->where(function ($q) {
                    $q->whereColumn('cl.id_peg', 's.id_peg_rsm') // RSM langsung lolos
                        ->orWhere(function ($q2) {
                            $q2->whereColumn('cl.id_peg', 's.id_peg_mr') // MR
                                ->whereIn('dm.status', ['Vacant', 'Dummy'])
                                ->whereIn('rsm.status', ['Vacant', 'Dummy']);
                        })
                        ->orWhere(function ($q2) {
                            $q2->whereColumn('cl.id_peg', 's.id_peg_dm') // DM
                                ->whereIn('rsm.status', ['Vacant', 'Dummy']);
                        });
                })

                ->select(
                    'dp.rowid as id_peg',
                    'dp.nama as nama_pegawai',
                    DB::raw('COUNT(DISTINCT cl.id) as total_request')
                )

                ->groupBy('dp.rowid', 'dp.nama')
                ->orderBy('dp.nama')
                ->get();
        } else if (str_contains($getjabatan->jabatan, 'PM')) {
            $employees = DB::table('call_list as cl')
                ->join('data_pegawai as dp', 'dp.rowid', '=', 'cl.id_peg')
                ->whereNull('cl.approval')
                ->whereBetween('cl.periode', [$startDate, $endDate])

                ->where(function ($q) use ($getjabatan) {
                    $q->whereIn('dp.divisi', explode(',', $getjabatan->divisi));
                    $q->where('dp.jabatan', 'PE');
                })

                ->select(
                    'dp.rowid as id_peg',
                    'dp.nama as nama_pegawai',
                    DB::raw('COUNT(DISTINCT cl.id) as total_request')
                )

                ->groupBy('dp.rowid', 'dp.nama')
                ->orderBy('dp.nama')
                ->get();
        } else if (str_contains($getjabatan->jabatan, 'DMD')) {
            $employees = DB::table('call_list as cl')
                ->join('data_pegawai as dp', 'dp.rowid', '=', 'cl.id_peg')
                ->whereNull('cl.approval')
                ->whereBetween('cl.periode', [$startDate, $endDate])

                ->where(function ($q) {
                    $q->where('dp.jabatan', 'PM');
                })

                ->select(
                    'dp.rowid as id_peg',
                    'dp.nama as nama_pegawai',
                    DB::raw('COUNT(DISTINCT cl.id) as total_request')
                )

                ->groupBy('dp.rowid', 'dp.nama')
                ->orderBy('dp.nama')
                ->get();
        } else {
            $employees = null;
        }

        return response()->json([
            'success' => true,
            'data' => $employees
        ]);
    }

    public function DmApprovalListDetails(Request $req)
    {
        $idPeg = $req->input('id_peg');
        $month = $req->input('month');
        $year  = $req->input('year');

        if (!$idPeg || !$month || !$year) {
            return response()->json([
                'success' => false,
                'message' => 'id_peg, month, and year are required'
            ], 400);
        }

        $periodeString = sprintf('%04d-%02d', $year, $month); // YYYY-MM
        $startDate     = sprintf('%04d-%02d-01', $year, $month);

        // [CONFIG] FILTER: jika deadline 5 hari kerja bulan ini sudah lewat → empty
        $getdivisi = DB::table('data_pegawai')->select(DB::raw('group_concat(distinct jabatan) as jabatan'), DB::raw('group_concat(distinct divisi) as divisi'))->where('rowid', $idPeg)->first();

        $cekpegawai = DB::table('call_setting as a')
            ->join('data_pegawai as b', function ($join) {
                $join->on('a.user', '=', 'b.id_user');
            })
            ->join('struktur as c', function ($join) {
                $join->where(function ($q) {
                    $q->whereColumn('c.id_peg_dm', 'b.rowid')
                        ->orWhereColumn('c.id_peg_rsm', 'b.rowid')
                        ->orWhereColumn('c.id_peg_mm', 'b.rowid');
                });
            })
            ->select('b.rowid', 'a.jumlah')
            ->where('a.input_set', 'Approval Call List')
            ->where(function ($q) use ($idPeg) {
                $q->where('c.id_peg_dm', $idPeg)
                    ->orWhere('c.id_peg_rsm', $idPeg)
                    ->orWhere('c.id_peg_mr', $idPeg);
            })
            ->GroupBy('b.rowid', 'a.jumlah')
            ->first();
 
        $cekpm = DB::table('call_setting as a')
            ->join('data_pegawai as b', function ($join) {
                $join->on('a.user', '=', 'b.id_user');
            })
            ->select('b.rowid', 'a.jumlah')
            ->where('a.input_set', 'Call List')
            ->where('b.rowid', $idPeg)
            ->whereIn('b.divisi', explode(',', $getdivisi->divisi))
            ->GroupBy('b.rowid', 'a.jumlah')
            ->first();
            
        if (self::BATAS_HARI_KERJA_LIST !== null && empty($cekpegawai->rowid) && empty($cekpm->rowid)) {
            if ((empty(self::OVERRIDE_BULAN_LIST) || trim(self::OVERRIDE_BULAN_LIST) !== $periodeString) && (!str_contains($getdivisi->jabatan, 'PM') && !str_contains($getdivisi->jabatan, 'PE'))) {
                $deadlineCL = $this->hitungDeadlineHariKerja(
                    Carbon::createFromFormat('Y-m-d', $startDate, 'Asia/Jakarta'),
                    self::BATAS_HARI_KERJA_LIST
                );
                if (Carbon::now('Asia/Jakarta')->startOfDay()->gt($deadlineCL->startOfDay())) {
                    return response()->json(['success' => true, 'data' => []]);
                }
            } else {
                $deadlineCL = $this->hitungDeadlineHariKerja(
                    Carbon::createFromFormat('Y-m-d', $startDate, 'Asia/Jakarta'),
                    self::BATAS_HARI_KERJA_LIST
                );
                if (Carbon::now('Asia/Jakarta')->startOfDay()->gt($deadlineCL->startOfDay())) {
                    return response()->json(['success' => true, 'data' => []]);
                }
            }
        } else {
            if ((empty(self::OVERRIDE_BULAN_LIST) || trim(self::OVERRIDE_BULAN_LIST) !== $periodeString) && (!str_contains($getdivisi->jabatan, 'PM') && !str_contains($getdivisi->jabatan, 'PE'))) {
                $deadlineCL = $this->hitungDeadlineHariKerja(
                    Carbon::createFromFormat('Y-m-d', $startDate, 'Asia/Jakarta'),
                    $cekpegawai->jumlah
                );
                if (Carbon::now('Asia/Jakarta')->startOfDay()->gt($deadlineCL->startOfDay())) {
                    return response()->json(['success' => true, 'data' => []]);
                }
            } else {
                $deadlineCL = $this->hitungDeadlineHariKerja(
                    Carbon::createFromFormat('Y-m-d', $startDate, 'Asia/Jakarta'),
                    $cekpm->jumlah
                );
                if (Carbon::now('Asia/Jakarta')->startOfDay()->gt($deadlineCL->startOfDay())) {
                    return response()->json(['success' => true, 'data' => []]);
                }
            }
        }

        $requests = DB::table('call_list as cl')
            ->where('cl.id_peg', $idPeg)
            ->whereNull('cl.approval')
            ->where('cl.periode', 'like', "$periodeString%")
            ->select(
                'cl.id',
                'cl.periode',
                'cl.nama_dokter',
                'cl.spec',
                'cl.segmen',
                'cl.class'
            )
            ->orderBy('cl.periode')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $requests
        ]);
    }

    public function DmApprovalListSave(Request $req)
    {
        $v = $this->checkAppVersion($req);
        if ($v) return $v;
        $dmPeg = $req->input('dm_id_peg');
        $approvals = $req->input('approvals');

        if (!$dmPeg || !$approvals || !is_array($approvals)) {
            return response()->json([
                'success' => false,
                'message' => 'dm_id_peg and approvals array are required'
            ], 400);
        }

        // [CONFIG] CEK BATAS WAKTU APPROVAL CALL LIST
        $cekpegawai = DB::table('call_setting as a')->join('data_pegawai as b', function ($join) {
            $join->on('a.user', '=', 'b.id_user');
        })->select('b.rowid', 'a.jumlah')
            ->where('b.rowid', $dmPeg)->where('a.input_set', 'Approval Call List')->first();

        if (self::BATAS_HARI_KERJA_LIST !== null && empty($cekpegawai->rowid)) {
            $firstId = $approvals[0]['id'] ?? null;
            if ($firstId) {
                $callListRecord = DB::table('call_list')->where('id', $firstId)->select('periode')->first();
                if ($callListRecord && $callListRecord->periode) {
                    $bulanPeriode = Carbon::parse($callListRecord->periode)->format('Y-m');

                    if (empty(self::OVERRIDE_BULAN_LIST) || trim(self::OVERRIDE_BULAN_LIST) !== $bulanPeriode) {
                        $deadlineCL = $this->hitungDeadlineHariKerja(
                            Carbon::createFromFormat('Y-m-d', $callListRecord->periode, 'Asia/Jakarta'),
                            self::BATAS_HARI_KERJA_LIST
                        );

                        if (Carbon::now('Asia/Jakarta')->startOfDay()->gt($deadlineCL->startOfDay())) {
                            $deadlineFormatted = $deadlineCL->translatedFormat('d F Y');
                            return response()->json([
                                'success'    => false,
                                'error_code' => 'APPROVAL_LIST_EXPIRED',
                                'message'    => 'Approval call list tidak dapat dilakukan. Batas waktu ' . self::BATAS_HARI_KERJA_LIST . " hari kerja awal bulan sudah terlewat (deadline: {$deadlineFormatted}).",
                            ], 422);
                        }
                    }
                }
            }
        } else {
            $firstId = $approvals[0]['id'] ?? null;
            if ($firstId) {
                $callListRecord = DB::table('call_list')->where('id', $firstId)->select('periode')->first();
                if ($callListRecord && $callListRecord->periode) {
                    $bulanPeriode = Carbon::parse($callListRecord->periode)->format('Y-m');

                    if (empty(self::OVERRIDE_BULAN_LIST) || trim(self::OVERRIDE_BULAN_LIST) !== $bulanPeriode) {
                        $deadlineCL = $this->hitungDeadlineHariKerja(
                            Carbon::createFromFormat('Y-m-d', $callListRecord->periode, 'Asia/Jakarta'),
                            $cekpegawai->jumlah
                        );

                        if (Carbon::now('Asia/Jakarta')->startOfDay()->gt($deadlineCL->startOfDay())) {
                            $deadlineFormatted = $deadlineCL->translatedFormat('d F Y');
                            return response()->json([
                                'success'    => false,
                                'error_code' => 'APPROVAL_LIST_EXPIRED',
                                'message'    => 'Approval call list tidak dapat dilakukan. Batas waktu ' . self::BATAS_HARI_KERJA_LIST . " hari kerja awal bulan sudah terlewat (deadline: {$deadlineFormatted}).",
                            ], 422);
                        }
                    }
                }
            }
        }

        $now = Carbon::now('Asia/Jakarta');

        foreach ($approvals as $item) {
            $id = $item['id'] ?? null;
            $approved = ($item['approval'] ?? '') === 'Approve';

            if (!$id) continue;

            // Simpan approval_comment saat Reject-agar karyawan tahu alasan reject saat membuka form edit
            $comment = !$approved ? ($item['approval_comment'] ?? null) : null;

            DB::table('call_list')
                ->where('id', $id)
                ->update([
                    'approval'         => $approved ? 'Approve' : 'Reject',
                    'approval_by'      => $dmPeg,
                    'approval_date'    => $now,
                    'approval_comment' => $comment,
                ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Approvals saved successfully'
        ]);
    }

    // APPROVAL CALL PLAN 
    public function DmApprovalPlanName(Request $req)
    {
        $idPegList = array_map('intval', $req->input('id_peg', []));
        $month = (int) $req->input('month');
        $year  = (int) $req->input('year');

        if (empty($idPegList)) {
            return response()->json([
                'success' => false,
                'message' => 'id_peg is required'
            ], 400);
        }

        if (!$month || !$year) {
            return response()->json([
                'success' => false,
                'message' => 'month and year are required'
            ], 400);
        }

        // Build date range for the month
        $startDate = sprintf('%04d-%02d-01', $year, $month);
        $endDate   = date('Y-m-t', strtotime($startDate));
        // $monthyear   = date('Y-m-20', strtotime($startDate));
        $monthyear   = date('Y-m-d');

        // ============================================================
        // [CONFIG] FILTER tgl_plan: hanya tampilkan yang belum expired.
        // Logika: tgl_plan > hari ini → selalu tampil.
        //         tgl_plan = hari ini → tampil hanya jika belum lewat BATAS_JAM_PLAN.
        //         tgl_plan < hari ini → sudah expired, tidak tampil.
        // ============================================================
        $today         = Carbon::now('Asia/Jakarta')->format('Y-m-d');
        $tglPlanFilter = $today;
        if (self::BATAS_JAM_PLAN !== null && $this->sudahLewatJam(self::BATAS_JAM_PLAN)) {
            $tglPlanFilter = Carbon::now('Asia/Jakarta')->addDay()->format('Y-m-d');
        }

        $getjabatan = DB::table('data_pegawai')->select(DB::raw('group_concat(distinct jabatan) as jabatan'), DB::raw('group_concat(distinct divisi) as divisi'))->whereIn('rowid', $idPegList)->first();

        if (str_contains($getjabatan->jabatan, 'ACT. DM') || str_contains($getjabatan->jabatan, 'DM')) {
            $employees = DB::table('call_plan_actual as cl')
                ->join('data_pegawai as dp', 'dp.rowid', '=', 'cl.id_peg')
                ->join('struktur as s', function ($join) {
                    $join->on('s.id_peg_mr', '=', 'cl.id_peg')
                        ->orOn('s.id_peg_dm', '=', 'cl.id_peg');
                })
                ->leftJoin('data_pegawai as rsm', 'rsm.rowid', '=', 's.id_peg_rsm')
                ->leftJoin('data_pegawai as mm', 'mm.rowid', '=', 's.id_peg_mm')
                // ->where('s.periode_akhir', $monthyear)
                ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                ->whereIn('s.id_peg_dm', $idPegList)
                ->whereNull('cl.approval')
                ->whereNotNull('cl.tgl_plan')
                ->whereBetween('cl.tgl_plan', [$startDate, $endDate])
                // [CONFIG] Filter tgl_plan expired
                ->where('cl.tgl_plan', '>=', $tglPlanFilter)
                ->where(function ($q) {
                    $q->whereColumn('cl.id_peg', 's.id_peg_mr')
                        ->orWhere(function ($q2) {
                            $q2->whereColumn('cl.id_peg', 's.id_peg_dm')
                                ->whereIn('rsm.status', ['Vacant', 'Dummy'])
                                ->whereIn('mm.status', ['Vacant', 'Dummy']);
                        });
                })
                ->select(
                    'dp.rowid as id_peg',
                    'dp.nama as nama_pegawai',
                    // DB::raw('COUNT(cl.id) as total_request') 
                    DB::raw('COUNT(DISTINCT cl.id) as total_request')
                )
                ->groupBy('dp.rowid', 'dp.nama')
                ->orderBy('dp.nama')
                ->get();
        } else if (str_contains($getjabatan->jabatan, 'RSM')) {
            $employees = DB::table('call_plan_actual as cl')
                ->join('data_pegawai as dp', 'dp.rowid', '=', 'cl.id_peg')
                ->join('struktur as s', function ($join) {
                    $join->on('s.id_peg_dm', '=', 'cl.id_peg')
                        ->orOn('s.id_peg_mr', '=', 'cl.id_peg')
                        ->orOn('s.id_peg_rsm', '=', 'cl.id_peg');
                })

                ->leftJoin('data_pegawai as dm', 'dm.rowid', '=', 's.id_peg_dm')
                ->leftJoin('data_pegawai as mm', 'mm.rowid', '=', 's.id_peg_mm')

                // ->where('s.periode_akhir', $monthyear)
                ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                ->whereIn('s.id_peg_rsm', $idPegList)
                ->whereNull('cl.approval')
                ->whereNotNull('cl.tgl_plan')
                ->whereBetween('cl.tgl_plan', [$startDate, $endDate])
                // [CONFIG] Filter tgl_plan expired
                ->where('cl.tgl_plan', '>=', $tglPlanFilter)

                ->where(function ($q) {
                    $q->whereColumn('cl.id_peg', 's.id_peg_dm')
                        ->orWhere(function ($q2) {
                            $q2->whereColumn('cl.id_peg', 's.id_peg_mr')
                                ->whereIn('dm.status', ['Vacant', 'Dummy']);
                        })
                        ->orWhere(function ($q3) {
                            $q3->whereColumn('cl.id_peg', 's.id_peg_rsm')
                                ->whereIn('mm.status', ['Vacant', 'Dummy']);
                        });
                })

                ->select(
                    'dp.rowid as id_peg',
                    'dp.nama as nama_pegawai',
                    DB::raw('COUNT(distinct cl.id) as total_request')
                )

                ->groupBy('dp.rowid', 'dp.nama')
                ->orderBy('dp.nama')
                ->get();
        } else if (str_contains($getjabatan->jabatan, 'MM')) {
            $employees = DB::table('call_plan_actual as cl')
                ->join('data_pegawai as dp', 'dp.rowid', '=', 'cl.id_peg')

                ->join('struktur as s', function ($join) {
                    $join->on(function ($q) {
                        $q->on('s.id_peg_dm', '=', 'cl.id_peg')
                            ->orOn('s.id_peg_mr', '=', 'cl.id_peg')
                            ->orOn('s.id_peg_rsm', '=', 'cl.id_peg');
                    });
                })

                ->leftJoin('data_pegawai as dm', 'dm.rowid', '=', 's.id_peg_dm')

                ->leftJoin('data_pegawai as rsm', 'rsm.rowid', '=', 's.id_peg_rsm')

                // ->where('s.periode_akhir', $monthyear)
                ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                ->whereIn('s.id_peg_mm', $idPegList)
                ->whereNull('cl.approval')
                ->whereNotNull('cl.tgl_plan')
                ->whereBetween('cl.tgl_plan', [$startDate, $endDate])
                // [CONFIG] Filter tgl_plan expired
                ->where('cl.tgl_plan', '>=', $tglPlanFilter)

                // filter: DM/RSM vacant/dummy
                ->where(function ($q) {
                    $q->whereColumn('cl.id_peg', 's.id_peg_rsm') // RSM langsung lolos
                        ->orWhere(function ($q2) {
                            $q2->whereColumn('cl.id_peg', 's.id_peg_mr') // MR
                                ->whereIn('dm.status', ['Vacant', 'Dummy'])
                                ->whereIn('rsm.status', ['Vacant', 'Dummy']);
                        })
                        ->orWhere(function ($q2) {
                            $q2->whereColumn('cl.id_peg', 's.id_peg_dm') // DM
                                ->whereIn('rsm.status', ['Vacant', 'Dummy']);
                        });
                })

                ->select(
                    'dp.rowid as id_peg',
                    'dp.nama as nama_pegawai',
                    // DB::raw('COUNT(cl.id) as total_request') 
                    DB::raw('COUNT(DISTINCT cl.id) as total_request')
                )

                ->groupBy('dp.rowid', 'dp.nama')
                ->orderBy('dp.nama')
                ->get();
        } else if (str_contains($getjabatan->jabatan, 'PM')) {
            $employees = DB::table('call_plan_actual as cl')
                ->join('data_pegawai as dp', 'dp.rowid', '=', 'cl.id_peg')

                ->where(function ($q) use ($getjabatan) {
                    $q->whereIn('dp.divisi', explode(',', $getjabatan->divisi));
                    $q->where('dp.jabatan', 'PE');
                })
                ->whereNull('cl.approval')
                ->whereNotNull('cl.tgl_plan')
                ->whereBetween('cl.tgl_plan', [$startDate, $endDate])
                // [CONFIG] Filter tgl_plan expired
                ->where('cl.tgl_plan', '>=', $tglPlanFilter)

                ->select(
                    'dp.rowid as id_peg',
                    'dp.nama as nama_pegawai',
                    DB::raw('COUNT(DISTINCT cl.id) as total_request')
                )

                ->groupBy('dp.rowid', 'dp.nama')
                ->orderBy('dp.nama')
                ->get();
        } else if (str_contains($getjabatan->jabatan, 'DMD')) {
            $employees = DB::table('call_plan_actual as cl')
                ->join('data_pegawai as dp', 'dp.rowid', '=', 'cl.id_peg')

                ->where(function ($q) {
                    $q->where('dp.jabatan', 'PM');
                })

                ->whereNull('cl.approval')
                ->whereNotNull('cl.tgl_plan')
                ->whereBetween('cl.tgl_plan', [$startDate, $endDate])
                // [CONFIG] Filter tgl_plan expired
                ->where('cl.tgl_plan', '>=', $tglPlanFilter)

                ->select(
                    'dp.rowid as id_peg',
                    'dp.nama as nama_pegawai',
                    DB::raw('COUNT(DISTINCT cl.id) as total_request')
                )

                ->groupBy('dp.rowid', 'dp.nama')
                ->orderBy('dp.nama')
                ->get();
        } else {
            $employees = null;
        }

        return response()->json([
            'success' => true,
            'data' => $employees
        ]);
    }

    // Get plan approval details for specific employee
    public function DmApprovalPlanDetails(Request $req)
    {
        $idPeg = $req->input('id_peg');
        $month = $req->input('month');
        $year  = $req->input('year');

        if (!$idPeg || !$month || !$year) {
            return response()->json([
                'success' => false,
                'message' => 'id_peg, month, and year are required'
            ], 400);
        }

        // Build date range for the month
        $startDate = sprintf('%04d-%02d-01', $year, $month);
        $endDate   = date('Y-m-t', strtotime($startDate));

        // [CONFIG] FILTER tgl_plan expired
        $today         = Carbon::now('Asia/Jakarta')->format('Y-m-d');
        $tglPlanFilter = $today;
        if (self::BATAS_JAM_PLAN !== null && $this->sudahLewatJam(self::BATAS_JAM_PLAN)) {
            $tglPlanFilter = Carbon::now('Asia/Jakarta')->addDay()->format('Y-m-d');
        }

        $requests = DB::table('call_plan_actual as cpa')
            ->where('cpa.id_peg', $idPeg)
            ->whereNull('cpa.approval')
            ->whereNotNull('cpa.tgl_plan')
            ->whereBetween('cpa.tgl_plan', [$startDate, $endDate])
            // [CONFIG] Hanya tampilkan yang belum expired
            ->where('cpa.tgl_plan', '>=', $tglPlanFilter)
            ->select(
                'cpa.id',
                'cpa.tgl_plan',
                'cpa.waktu',
                'cpa.id_mcl',
                'cpa.nama_dokter',
                'cpa.spec',
                'cpa.segmen_md',
                'cpa.class',
                'cpa.institusi',
                'cpa.alamat_praktek'
            )
            ->orderBy('cpa.tgl_plan')
            ->orderBy('cpa.waktu')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $requests
        ]);
    }

    // Save plan approval
    public function DmApprovalPlanSave(Request $req)
    {
        $v = $this->checkAppVersion($req);
        if ($v) return $v;
        $dmPeg     = $req->input('dm_id_peg');
        $approvals = $req->input('approvals');

        // if (!$dmPeg || !$approvals || !is_array($approvals)) {
        if (!$dmPeg || !is_array($approvals)) {
            return response()->json([
                'success' => false,
                'message' => 'dm_id_peg and approvals array are required'
            ], 400);
        }

        $now   = Carbon::now('Asia/Jakarta');
        $today = $now->format('Y-m-d');

        foreach ($approvals as $item) {
            $id       = $item['id'] ?? null;
            $decision = $item['approval'] ?? null;

            if (!$id || !in_array($decision, ['Approve', 'Reject'])) {
                continue;
            }

            // ============================================================
            // [CONFIG] VALIDASI per-item berdasarkan tgl_plan di database.
            // Logika:
            //   tgl_plan > hari ini           → boleh approve kapan saja
            //   tgl_plan = hari ini           → boleh hanya sebelum BATAS_JAM_PLAN
            //   tgl_plan < hari ini           → expired, tolak
            // ============================================================
            if (self::BATAS_JAM_PLAN !== null) {
                $plan = DB::table('call_plan_actual')->select('tgl_plan')->where('id', $id)->first();
                if ($plan && $plan->tgl_plan) {
                    if ($plan->tgl_plan < $today) {
                        // tgl_plan sudah lewat → expired
                        return response()->json([
                            'success'    => false,
                            'error_code' => 'APPROVAL_PLAN_EXPIRED',
                            'message'    => "Approval call plan gagal: tgl_plan ({$plan->tgl_plan}) sudah terlewat. Approval hanya bisa dilakukan sampai hari tgl_plan sebelum pukul " . self::BATAS_JAM_PLAN . ":00 WIB.",
                        ], 422);
                    }
                    if ($plan->tgl_plan === $today && $this->sudahLewatJam(self::BATAS_JAM_PLAN)) {
                        // tgl_plan = hari ini tapi sudah lewat jam batas
                        return response()->json([
                            'success'    => false,
                            'error_code' => 'APPROVAL_PLAN_TIME_EXPIRED',
                            'message'    => 'Approval call plan gagal: sudah melewati pukul ' . self::BATAS_JAM_PLAN . ':00 WIB untuk tgl_plan hari ini.',
                        ], 422);
                    }
                    // tgl_plan > today, atau tgl_plan = today && belum lewat jam → OK
                }
            }
            $updateData = [
                'approval'      => $decision,
                'approval_by'   => $dmPeg,
                'approval_date' => $now,
            ];

            //  IMPORTANT PART
            if ($decision === 'Reject') {
                $updateData['approval_actual']      = 'Reject';
                $updateData['approval_actual_by']   = $dmPeg;
                $updateData['approval_actual_date'] = $now;
            }

            DB::table('call_plan_actual')
                ->where('id', $id)
                ->update($updateData);
        }

        return response()->json([
            'success' => true,
            'message' => 'Plan approvals saved successfully'
        ]);
    }

    // APPROVAL CALL ACTUAL -
    // Get employees with pending actual approval requests
    public function DmApprovalActualName(Request $req)
    {
        $idPegList = array_map('intval', $req->input('id_peg', []));
        $month = (int) $req->input('month');
        $year  = (int) $req->input('year');

        if (empty($idPegList)) {
            return response()->json([
                'success' => false,
                'message' => 'id_peg is required'
            ], 400);
        }

        if (!$month || !$year) {
            return response()->json([
                'success' => false,
                'message' => 'month and year are required'
            ], 400);
        }

        // Build date range for the month
        $startDate = sprintf('%04d-%02d-01', $year, $month);
        $endDate   = date('Y-m-t', strtotime($startDate));
        // $monthyear   = date('Y-m-20', strtotime($startDate));
        $monthyear   = date('Y-m-d');

        // ============================================================
        // [CONFIG] HITUNG cutoff tgl_actual yang masih bisa di-approve.
        // Logika (BATAS_HARI_ACTUAL=1, BATAS_JAM_ACTUAL=10):
        //   tgl_actual = hari ini         → selalu tampil (deadline besok jam 10)
        //   tgl_actual = kemarin          → tampil hanya jika jam sekarang < 10:00
        //   tgl_actual = 2+ hari lalu     → expired, tidak tampil
        // Setelah deadline terlewat → approval_actual tetap NULL selamanya (tidak akan tampil lagi)
        // ============================================================

        $cekpegawai = DB::table('call_setting as a')->join('data_pegawai as b', function ($join) {
            $join->on('a.user', '=', 'b.id_user');
        })->select('b.rowid', 'a.jumlah')
            ->whereIn('b.rowid', $idPegList)->where('a.input_set', 'Approval Actual')->first();

        $cutoffTglActual = null;

        if (self::BATAS_HARI_ACTUAL !== null && empty($cekpegawai->rowid)) {
            $now = Carbon::now('Asia/Jakarta');
            $extraDays = 0;

            if ($now->isSunday()) {
                $extraDays = 1;
            } elseif ($now->isMonday()) {
                $extraDays = 2;
            }

            if (self::BATAS_JAM_ACTUAL !== null && $this->sudahLewatJam(self::BATAS_JAM_ACTUAL)) {
                // Sudah lewat jam batas hari ini → hari ke-BATAS_HARI_ACTUAL sudah expired
                // cutoff = hari ini - (BATAS_HARI_ACTUAL - 1)
                $cutoffTglActual = $now->copy()->subDays(self::BATAS_HARI_ACTUAL - 1)->format('Y-m-d');
            } else {
                // Belum lewat jam batas → hari ke-BATAS_HARI_ACTUAL masih valid
                // cutoff = hari ini - BATAS_HARI_ACTUAL
                $cutoffTglActual = $now->copy()->subDays(self::BATAS_HARI_ACTUAL + $extraDays)->format('Y-m-d');
            }
        } else {
            $now = Carbon::now('Asia/Jakarta');
            // Belum lewat jam batas → hari ke-BATAS_HARI_ACTUAL masih valid
            // cutoff = hari ini - BATAS_HARI_ACTUAL
            $cutoffTglActual = $now->copy()->subDays($cekpegawai->jumlah)->format('Y-m-d');
        }

        $getjabatan = DB::table('data_pegawai')->select(DB::raw('group_concat(distinct jabatan) as jabatan'), DB::raw('group_concat(distinct divisi) as divisi'))->whereIn('rowid', $idPegList)->first();

        if ((str_contains($getjabatan->jabatan, 'ACT. DM') || str_contains($getjabatan->jabatan, 'DM'))) {
            $employees = DB::table('call_plan_actual as cl')
                ->join('data_pegawai as dp', 'dp.rowid', '=', 'cl.id_peg')
                ->join('struktur as s', function ($join) {
                    $join->on('s.id_peg_mr', '=', 'cl.id_peg')
                        ->orOn('s.id_peg_dm', '=', 'cl.id_peg');
                })
                ->leftJoin('data_pegawai as rsm', 'rsm.rowid', '=', 's.id_peg_rsm')
                ->leftJoin('data_pegawai as mm', 'mm.rowid', '=', 's.id_peg_mm')
                // ->where('s.periode_akhir', $monthyear)
                ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                ->whereIn('s.id_peg_dm', $idPegList)
                ->whereNull('cl.approval_actual')
                ->whereNotNull('cl.tgl_actual')
                ->whereBetween('cl.tgl_actual', [$startDate, $endDate])
                // [CONFIG] Filter tgl_actual expired
                ->when($cutoffTglActual !== null, fn($q) => $q->where('cl.tgl_actual', '>=', $cutoffTglActual))
                ->where(function ($q) {
                    $q->whereColumn('cl.id_peg', 's.id_peg_mr')
                        ->orWhere(function ($q2) {
                            $q2->whereColumn('cl.id_peg', 's.id_peg_dm')
                                ->whereIn('rsm.status', ['Vacant', 'Dummy'])
                                ->whereIn('mm.status', ['Vacant', 'Dummy']);
                        });
                })
                ->select(
                    'dp.rowid as id_peg',
                    'dp.nama as nama_pegawai',
                    DB::raw('COUNT(distinct cl.id) as total_request')
                )
                ->groupBy('dp.rowid', 'dp.nama')
                ->orderBy('dp.nama')
                ->get();
        } else if (str_contains($getjabatan->jabatan, 'RSM')) {
            $employees = DB::table('call_plan_actual as cl')
                ->join('data_pegawai as dp', 'dp.rowid', '=', 'cl.id_peg')

                ->join('struktur as s', function ($join) {
                    $join->on('s.id_peg_dm', '=', 'cl.id_peg')
                        ->orOn('s.id_peg_mr', '=', 'cl.id_peg')
                        ->orOn('s.id_peg_rsm', '=', 'cl.id_peg');
                })

                ->leftJoin('data_pegawai as dm', 'dm.rowid', '=', 's.id_peg_dm')
                ->leftJoin('data_pegawai as mm', 'mm.rowid', '=', 's.id_peg_mm')

                // ->where('s.periode_akhir', $monthyear)
                ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                ->whereIn('s.id_peg_rsm', $idPegList)
                ->whereNull('cl.approval_actual')
                ->whereNotNull('cl.tgl_actual')
                ->whereBetween('cl.tgl_actual', [$startDate, $endDate])
                // [CONFIG] Filter tgl_actual expired
                ->when($cutoffTglActual !== null, fn($q) => $q->where('cl.tgl_actual', '>=', $cutoffTglActual))

                ->where(function ($q) {
                    $q->whereColumn('cl.id_peg', 's.id_peg_dm')
                        ->orWhere(function ($q2) {
                            $q2->whereColumn('cl.id_peg', 's.id_peg_mr')
                                ->whereIn('dm.status', ['Vacant', 'Dummy']);
                        })
                        ->orWhere(function ($q3) {
                            $q3->whereColumn('cl.id_peg', 's.id_peg_rsm')
                                ->whereIn('mm.status', ['Vacant', 'Dummy']);
                        });
                })

                ->select(
                    'dp.rowid as id_peg',
                    'dp.nama as nama_pegawai',
                    DB::raw('COUNT(distinct cl.id) as total_request')
                )

                ->groupBy('dp.rowid', 'dp.nama')
                ->orderBy('dp.nama')
                ->get();
        } else if (str_contains($getjabatan->jabatan, 'MM')) {
            $employees = DB::table('call_plan_actual as cl')
                ->join('data_pegawai as dp', 'dp.rowid', '=', 'cl.id_peg')

                ->join('struktur as s', function ($join) {
                    $join->on(function ($q) {
                        $q->on('s.id_peg_dm', '=', 'cl.id_peg')
                            ->orOn('s.id_peg_mr', '=', 'cl.id_peg')
                            ->orOn('s.id_peg_rsm', '=', 'cl.id_peg');
                    });
                })

                ->leftJoin('data_pegawai as dm', 'dm.rowid', '=', 's.id_peg_dm')

                ->leftJoin('data_pegawai as rsm', 'rsm.rowid', '=', 's.id_peg_rsm')

                // ->where('s.periode_akhir', $monthyear)
                ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                ->whereIn('s.id_peg_mm', $idPegList)
                ->whereNull('cl.approval_actual')
                ->whereNotNull('cl.tgl_actual')
                ->whereBetween('cl.tgl_actual', [$startDate, $endDate])
                // [CONFIG] Filter tgl_actual expired
                ->when($cutoffTglActual !== null, fn($q) => $q->where('cl.tgl_actual', '>=', $cutoffTglActual))

                // filter: DM/RSM vacant/dummy
                ->where(function ($q) {
                    $q->whereColumn('cl.id_peg', 's.id_peg_rsm') // RSM langsung lolos
                        ->orWhere(function ($q2) {
                            $q2->whereColumn('cl.id_peg', 's.id_peg_mr') // MR
                                ->whereIn('dm.status', ['Vacant', 'Dummy'])
                                ->whereIn('rsm.status', ['Vacant', 'Dummy']);
                        })
                        ->orWhere(function ($q2) {
                            $q2->whereColumn('cl.id_peg', 's.id_peg_dm') // DM
                                ->whereIn('rsm.status', ['Vacant', 'Dummy']);
                        });
                })

                ->select(
                    'dp.rowid as id_peg',
                    'dp.nama as nama_pegawai',
                    DB::raw('COUNT(distinct cl.id) as total_request')
                )

                ->groupBy('dp.rowid', 'dp.nama')
                ->orderBy('dp.nama')
                ->get();
        } else if (str_contains($getjabatan->jabatan, 'PM')) {
            $employees = DB::table('call_plan_actual as cl')
                ->join('data_pegawai as dp', 'dp.rowid', '=', 'cl.id_peg')
                ->whereNull('cl.approval_actual')
                ->whereNotNull('cl.tgl_actual')
                ->whereBetween('cl.tgl_actual', [$startDate, $endDate])
                // ->when($cutoffTglActual !== null, fn($q) => $q->where('cl.tgl_actual', '>=', $cutoffTglActual))

                ->where(function ($q) use ($getjabatan) {
                    $q->whereIn('dp.divisi', explode(',', $getjabatan->divisi));
                    $q->where('dp.jabatan', 'PE');
                })

                ->select(
                    'dp.rowid as id_peg',
                    'dp.nama as nama_pegawai',
                    DB::raw('COUNT(distinct cl.id) as total_request')
                )

                ->groupBy('dp.rowid', 'dp.nama')
                ->orderBy('dp.nama')
                ->get();
        } else if (str_contains($getjabatan->jabatan, 'DMD')) {
            $employees = DB::table('call_plan_actual as cl')
                ->join('data_pegawai as dp', 'dp.rowid', '=', 'cl.id_peg')
                ->whereNull('cl.approval_actual')
                ->whereNotNull('cl.tgl_actual')
                ->whereBetween('cl.tgl_actual', [$startDate, $endDate])
                // ->when($cutoffTglActual !== null, fn($q) => $q->where('cl.tgl_actual', '>=', $cutoffTglActual))

                ->where(function ($q) {
                    $q->where('dp.jabatan', 'PM');
                })

                ->select(
                    'dp.rowid as id_peg',
                    'dp.nama as nama_pegawai',
                    DB::raw('COUNT(distinct cl.id) as total_request')
                )

                ->groupBy('dp.rowid', 'dp.nama')
                ->orderBy('dp.nama')
                ->get();
        } else {
            $employees = null;
        }

        return response()->json([
            'success' => true,
            'data' => $employees
        ]);
    }

    // Get actual approval details for specific employee
    public function DmApprovalActualDetails(Request $req)
    {
        $idPeg = $req->input('id_peg');
        $month = $req->input('month');
        $year  = $req->input('year');

        if (!$idPeg || !$month || !$year) {
            return response()->json([
                'success' => false,
                'message' => 'id_peg, month, and year are required'
            ], 400);
        }

        // Build date range for the month
        $startDate = sprintf('%04d-%02d-01', $year, $month);
        $endDate   = date('Y-m-t', strtotime($startDate));

        // [CONFIG] HITUNG cutoff tgl_actual 
        $getdivisi = DB::table('data_pegawai')->select(DB::raw('group_concat(distinct jabatan) as jabatan'), DB::raw('group_concat(distinct divisi) as divisi'))->where('rowid', $idPeg)->first();

        $cekpegawai = DB::table('call_setting as a')
            ->join('data_pegawai as b', function ($join) {
                $join->on('a.user', '=', 'b.id_user');
            })
            ->join('struktur as c', function ($join) {
                $join->where(function ($q) {
                    $q->whereColumn('c.id_peg_dm', 'b.rowid')
                        ->orWhereColumn('c.id_peg_rsm', 'b.rowid')
                        ->orWhereColumn('c.id_peg_mm', 'b.rowid');
                });
            })
            ->select('b.rowid', 'a.jumlah')
            ->where('a.input_set', 'Approval Actual')
            ->where(function ($q) use ($idPeg) {
                $q->where('c.id_peg_dm', $idPeg)
                    ->orWhere('c.id_peg_rsm', $idPeg)
                    ->orWhere('c.id_peg_mr', $idPeg);
            })
            ->GroupBy('b.rowid', 'a.jumlah')
            ->first();

        $cekpm = DB::table('call_setting as a')
            ->join('data_pegawai as b', function ($join) {
                $join->on('a.user', '=', 'b.id_user');
            })
            ->select('b.rowid', 'a.jumlah')
            ->where('a.input_set', 'Approval Actual')
            ->where('b.rowid', $idPeg)
            ->whereIn('b.divisi', explode(',', $getdivisi->divisi))
            ->GroupBy('b.rowid', 'a.jumlah')
            ->first();

        $cutoffTglActual = null;
        if (self::BATAS_HARI_ACTUAL !== null && empty($cekpegawai->rowid) && empty($cekpm->rowid)) {
            $now = Carbon::now('Asia/Jakarta');
            $extraDays = 0;

            if ($now->isSunday()) {
                $extraDays = 1;
            } elseif ($now->isMonday()) {
                $extraDays = 2;
            }

            if (self::BATAS_JAM_ACTUAL !== null && $this->sudahLewatJam(self::BATAS_JAM_ACTUAL)) {
                $cutoffTglActual = $now->copy()->subDays(self::BATAS_HARI_ACTUAL)->format('Y-m-d');
            } else {
                $cutoffTglActual = $now->copy()->subDays(self::BATAS_HARI_ACTUAL + $extraDays)->format('Y-m-d');
            }
        } else {
            $now = Carbon::now('Asia/Jakarta');
            if (str_contains($getdivisi->jabatan, 'PM') || str_contains($getdivisi->jabatan, 'PE')) {
                $cutoffTglActual = $now->copy()->subDays($cekpm->jumlah)->format('Y-m-d');
            } else {
                $cutoffTglActual = $now->copy()->subDays($cekpegawai->jumlah)->format('Y-m-d');
            }
        }
        $requests = DB::table('call_plan_actual as cpa')
            ->where('cpa.id_peg', $idPeg)
            ->whereNull('cpa.approval_actual')
            ->whereNotNull('cpa.tgl_actual')
            ->whereBetween('cpa.tgl_actual', [$startDate, $endDate])
            // [CONFIG] Hanya tampilkan yang belum expired
            ->when($cutoffTglActual !== null && !str_contains($getdivisi->jabatan, 'PM') && !str_contains($getdivisi->jabatan, 'PE'), fn($q) => $q->where('cpa.tgl_actual', '>=', $cutoffTglActual))
            ->select(
                'cpa.id',
                'cpa.tgl_plan',
                'cpa.waktu',
                'cpa.tgl_actual',
                'cpa.waktu_actual',
                'cpa.id_mcl',
                'cpa.nama_dokter',
                'cpa.spec',
                'cpa.segmen_md',
                'cpa.class',
                'cpa.institusi',
                'cpa.alamat_praktek',
                'cpa.keterangan',
                'cpa.status',
                'cpa.foto',
                'cpa.join_visit',
                'cpa.join_visit_ff'
            )
            ->orderBy('cpa.tgl_actual')
            ->orderBy('cpa.waktu_actual')
            ->get();

        // Resolve nama atasan dari join_visit_ff
        $result = $requests->map(function ($item) {
            $item = (array) $item;
            $joinVisitNames = [];
            if (
                !empty($item['join_visit']) && $item['join_visit'] == 1
                && !empty($item['join_visit_ff'])
                && ($item['status'] ?? '') !== 'join_visit'
            ) {
                $idParts = array_filter(array_map('trim', explode(',', $item['join_visit_ff'])));
                foreach ($idParts as $pegId) {
                    $pegId = (int) $pegId;
                    if ($pegId <= 0) continue;
                    $peg = DB::table('data_pegawai')->select('nama')->where('rowid', $pegId)->first();
                    if ($peg) $joinVisitNames[] = $peg->nama;
                }
            }
            $item['join_visit_names'] = $joinVisitNames;
            return $item;
        });

        return response()->json([
            'success' => true,
            'data' => $result
            //  'data' => $requests
        ]);
    }

    // Save actual approval
    public function DmApprovalActualSave(Request $req)
    {
        $v = $this->checkAppVersion($req);
        if ($v) return $v;
        date_default_timezone_set('Asia/Jakarta');

        $dmPeg = $req->input('dm_id_peg');
        $approvals = $req->input('approvals');

        if (!$dmPeg || !$approvals || !is_array($approvals)) {
            return response()->json([
                'success' => false,
                'message' => 'dm_id_peg and approvals array are required'
            ], 400);
        }

        $now   = Carbon::now('Asia/Jakarta');
        $today = $now->format('Y-m-d');

        $cekpegawai = DB::table('call_setting as a')->join('data_pegawai as b', function ($join) {
            $join->on('a.user', '=', 'b.id_user');
        })->select('b.rowid', 'a.jumlah')
            ->where('b.rowid', $dmPeg)->where('a.input_set', 'Approval Actual')->first();

        try {
            DB::transaction(function () use ($approvals, $dmPeg, $now, $today, $cekpegawai) {

                foreach ($approvals as $item) {
                    $id = $item['id'] ?? null;
                    $approved = ($item['approval_actual'] ?? '') === 'Approve';

                    if (!$id) continue;

                    $actual = DB::table('call_plan_actual')
                        ->select('id_mcl', 'id_peg', 'tgl_actual', 'foto','foto_link')
                        ->where('id', $id)
                        ->first();

                    if (!$actual) continue;

                    // VALIDASI FOTO: Approve tidak bisa dilakukan jika foto null atau kosong
                    // [S3] Cek foto_link (S3) JUGA — record baru hanya pakai foto_link
                    $approved = ($item['approval_actual'] ?? '') === 'Approve';
                    $hasFoto  = !is_null($actual->foto)      && trim($actual->foto)      !== '';
                    $hasFotoLink = !is_null($actual->foto_link) && trim($actual->foto_link) !== '';
                    if ($approved && !$hasFoto && !$hasFotoLink) {
                        throw new \Exception("approval_actual_no_foto:{$id}");
                    }
                    // ============================================================
                    // [CONFIG] VALIDASI per-item berdasarkan tgl_actual di database.
                    // Logika (BATAS_HARI_ACTUAL=1, BATAS_JAM_ACTUAL=10):
                    //   jarak = hari ini - tgl_actual (dalam hari, selalu positif)
                    //   jarak = 0  → tgl_actual = hari ini → boleh approve kapan saja
                    //   jarak = 1  → tgl_actual = kemarin  → boleh hanya sebelum BATAS_JAM_ACTUAL
                    //   jarak >= 2 → expired, tolak
                    // ============================================================
                    if (self::BATAS_HARI_ACTUAL !== null && $actual->tgl_actual && empty($cekpegawai->rowid)) {
                        $tglActualCarbon = Carbon::parse($actual->tgl_actual, 'Asia/Jakarta')->startOfDay();
                        $todayCarbon     = Carbon::now('Asia/Jakarta')->startOfDay();
                        $jarakHari       = (int) $tglActualCarbon->diffInDays($todayCarbon);

                        $extraDays = 0;

                        if ($now->isSunday()) {
                            $extraDays = 1; 
                        } elseif ($now->isMonday()) {
                            $extraDays = 2;  
                        }

                        $maxHari = self::BATAS_HARI_ACTUAL + $extraDays;

                        if ($jarakHari > $maxHari) {
                            // Sudah lebih dari BATAS_HARI_ACTUAL hari → expired
                            throw new \Exception("approval_actual_expired:{$id}");
                        }
                        if ($jarakHari === $maxHari && self::BATAS_JAM_ACTUAL !== null) {
                            // Tepat di hari batas → cek jam
                            if ($this->sudahLewatJam(self::BATAS_JAM_ACTUAL)) {
                                throw new \Exception("approval_actual_expired:{$id}");
                            }
                        }
                    } else {
                        $tglActualCarbon = Carbon::parse($actual->tgl_actual, 'Asia/Jakarta')->startOfDay();
                        $todayCarbon     = Carbon::now('Asia/Jakarta')->startOfDay();
                        $jarakHari       = (int) $tglActualCarbon->diffInDays($todayCarbon);

                        if ($jarakHari >= $cekpegawai->jumlah) {
                            throw new \Exception("approval_actual_expired:{$id}");
                        }
                    }

                    DB::table('call_plan_actual')
                        ->where('id', $id)
                        ->update([
                            'approval_actual' => $approved ? 'Approve' : 'Reject',
                            'approval_actual_by' => $dmPeg,
                            'approval_actual_date' => $now,
                            'approval_actual_comment' => $item['approval_actual_comment'] ?? null,
                        ]);

                    // ADDITION: update call_list when approved
                    if ($approved && $actual->tgl_actual) {
                        $periode = Carbon::parse($actual->tgl_actual)
                            ->startOfMonth()
                            ->format('Y-m-d'); // YYYY-MM-01

                        //cari semua id_peg milik orang yg sama via id_user
                        // Menangani kasus combo id_ff dimana 1 orang punya beberapa id_peg
                        $idUser = DB::table('data_pegawai')
                            ->where('rowid', $actual->id_peg)
                            ->value('id_user');
                        $allIdPeg = $idUser
                            ? DB::table('data_pegawai')->where('id_user', $idUser)->pluck('rowid')
                            : [$actual->id_peg];

                        DB::table('call_list')
                            ->whereIn('id_peg', $allIdPeg)
                            ->where('id_mcl', $actual->id_mcl)
                            ->where('periode', $periode)
                            ->update([
                                'is_visited'   => 1,
                                'updated_by'   => $dmPeg,
                                'updated_date' => $now,
                            ]);
                    }
                }
            });
        } catch (\Exception $e) {
            // Tangkap exception dari validasi foto tidak ada
            if (str_starts_with($e->getMessage(), 'approval_actual_no_foto')) {
                return response()->json([
                    'success'    => false,
                    'error_code' => 'APPROVAL_ACTUAL_NO_FOTO',
                    'message'    => 'Approval tidak dapat dilakukan karena foto tidak terdeteksi atau tidak ada.',
                ], 422);
            }
            // Tangkap exception dari validasi expired di dalam transaction
            if (str_starts_with($e->getMessage(), 'approval_actual_expired')) {
                return response()->json([
                    'success'    => false,
                    'error_code' => 'APPROVAL_ACTUAL_EXPIRED',
                    'message'    => 'Approval call actual gagal: sudah melewati batas ' . self::BATAS_HARI_ACTUAL . ' hari setelah tgl_actual (batas jam ' . (self::BATAS_JAM_ACTUAL ?? '-') . ':00 WIB di hari terakhir).',
                ], 422);
            }
            return response()->json(['success' => false, 'message' => 'Gagal menyimpan: ' . $e->getMessage()], 500);
        }

        return response()->json([
            'success' => true,
            'message' => 'Actual approvals saved successfully'
        ]);
    }

    // APPROVAL CALL ACTUAL SINGLE - Approval untuk satu item actual saja
    public function DmApprovalActualSingle(Request $req)
    {
        $v = $this->checkAppVersion($req);
        if ($v) return $v;
        $id = $req->input('id');                           // ID dari call_plan_actual
        $dmPeg = $req->input('dm_id_peg');                 // ID atasan yang approve
        $approvalStatus = $req->input('approval_actual'); // 'Approve' atau 'Reject'
        $comment = $req->input('approval_actual_comment'); // Komentar dari atasan (WAJIB)
        // $deviceTimeUtc = $req->input('approval_time_utc'); // 

        if (!$id || !$dmPeg || !$approvalStatus || empty(trim($comment ?? ''))) {
            return response()->json([
                'success' => false,
                'message' => 'id, dm_id_peg, approval_actual, dan approval_actual_comment wajib diisi'
            ], 400);
        }

        // Validasi nilai approval_actual
        if (!in_array($approvalStatus, ['Approve', 'Reject'])) {
            return response()->json([
                'success' => false,
                'message' => 'approval_actual must be "Approve" or "Reject"'
            ], 400);
        }

        $now = Carbon::now('Asia/Jakarta');

        $cekpegawai = DB::table('call_setting as a')->join('data_pegawai as b', function ($join) {
            $join->on('a.user', '=', 'b.id_user');
        })->select('b.rowid', 'a.jumlah')
            ->where('b.rowid', $dmPeg)->where('a.input_set', 'Approval Actual')->first();

        $getdivisi = DB::table('data_pegawai')->select(DB::raw('group_concat(distinct jabatan) as jabatan'), DB::raw('group_concat(distinct divisi) as divisi'))->where('rowid', $dmPeg)->first();

        try {
            DB::transaction(function () use ($id, $dmPeg, $approvalStatus, $comment, $now, $cekpegawai, $getdivisi) {
                // Ambil data actual
                $actual = DB::table('call_plan_actual')
                    ->select('id_mcl', 'id_peg', 'tgl_actual', 'foto','foto_link')
                    ->where('id', $id)
                    ->first();

                if (!$actual) {
                    throw new \Exception('Data tidak ditemukan');
                }

                // ============================================================
                // VALIDASI FOTO: Approve tidak bisa dilakukan jika foto null atau kosong
                // [S3] Cek foto_link (S3) JUGA — record baru hanya pakai foto_link
                // ============================================================
                $hasFoto     = !is_null($actual->foto)      && trim($actual->foto)      !== '';
                $hasFotoLink = !is_null($actual->foto_link) && trim($actual->foto_link) !== '';
                if ($approvalStatus === 'Approve' && !$hasFoto && !$hasFotoLink) {
                    throw new \Exception('APPROVAL_ACTUAL_NO_FOTO');
                }

                // ============================================================
                // [CONFIG] VALIDASI per-item berdasarkan tgl_actual di database.
                // Logika (BATAS_HARI_ACTUAL=1, BATAS_JAM_ACTUAL=10):
                //   jarak = 0 (hari ini)  → boleh approve kapan saja
                //   jarak = 1 (kemarin)   → boleh hanya sebelum BATAS_JAM_ACTUAL
                //   jarak >= 2            → expired, tolak
                // ============================================================
                if (!str_contains($getdivisi->jabatan, 'PE') && !str_contains($getdivisi->jabatan, 'PM') && !str_contains($getdivisi->jabatan, 'DMD')) {
                    if (self::BATAS_HARI_ACTUAL !== null && $actual->tgl_actual && empty($cekpegawai->rowid)) {
                        $tglActualCarbon = Carbon::parse($actual->tgl_actual, 'Asia/Jakarta')->startOfDay();
                        $todayCarbon     = Carbon::now('Asia/Jakarta')->startOfDay();
                        $jarakHari       = (int) $tglActualCarbon->diffInDays($todayCarbon);

                        $extraDays = 0;

                        if ($now->isSunday()) {
                            $extraDays = 1;
                        } elseif ($now->isMonday()) {
                            $extraDays = 2;
                        }

                        $maxHari = self::BATAS_HARI_ACTUAL + $extraDays;

                        if ($jarakHari > $maxHari) {
                            // Sudah lebih dari BATAS_HARI_ACTUAL hari → expired
                            throw new \Exception('APPROVAL_ACTUAL_EXPIRED');
                        }
                        if ($jarakHari === $maxHari && self::BATAS_JAM_ACTUAL !== null) {
                            // Tepat di hari batas → cek jam
                            if ($this->sudahLewatJam(self::BATAS_JAM_ACTUAL)) {
                                throw new \Exception('APPROVAL_ACTUAL_EXPIRED');
                            }
                        }
                    } else {
                        $tglActualCarbon = Carbon::parse($actual->tgl_actual, 'Asia/Jakarta')->startOfDay();
                        $todayCarbon     = Carbon::now('Asia/Jakarta')->startOfDay();
                        $jarakHari       = (int) $tglActualCarbon->diffInDays($todayCarbon);

                        if ($jarakHari >= $cekpegawai->jumlah) {
                            throw new \Exception('APPROVAL_ACTUAL_EXPIRED');
                        }
                    }
                }

                // Update call_plan_actual
                DB::table('call_plan_actual')
                    ->where('id', $id)
                    ->where(function ($query) {
                        $query->whereNull('approval_actual')
                            ->orWhere('approval_actual', 'Reject');
                    })
                    ->update([
                        'approval_actual' => $approvalStatus,
                        'approval_actual_by' => $dmPeg,
                        'approval_actual_date' => $now,
                        'approval_actual_comment' => $comment,
                    ]);

                // Jika APPROVE, update call_list.is_visited = 1
                if ($approvalStatus === 'Approve' && $actual->tgl_actual) {
                    $periode = Carbon::parse($actual->tgl_actual)
                        ->startOfMonth()
                        ->format('Y-m-d'); // YYYY-MM-01

                    // cari semua id_peg milik orang yg sama via id_user - Menangani kasus combo id_ff dimana 1 orang punya beberapa id_peg
                    $idUser = DB::table('data_pegawai')
                        ->where('rowid', $actual->id_peg)
                        ->value('id_user');
                    $allIdPeg = $idUser
                        ? DB::table('data_pegawai')->where('id_user', $idUser)->pluck('rowid')
                        : [$actual->id_peg];

                    DB::table('call_list')
                        ->whereIn('id_peg', $allIdPeg)
                        ->where('id_mcl', $actual->id_mcl)
                        ->where('periode', $periode)
                        ->update([
                            'is_visited'   => 1,
                            'updated_by'   => $dmPeg,
                            'updated_date' => $now,
                        ]);
                }
            });

            return response()->json([
                'success' => true,
                'message' => $approvalStatus === 'Approve'
                    ? 'Actual berhasil di-approve'
                    : 'Actual berhasil di-reject'
            ]);
        } catch (\Exception $e) {
            // Tangani foto tidak ada
            if ($e->getMessage() === 'APPROVAL_ACTUAL_NO_FOTO') {
                return response()->json([
                    'success'    => false,
                    'error_code' => 'APPROVAL_ACTUAL_NO_FOTO',
                    'message'    => 'Approval tidak dapat dilakukan karena foto tidak terdeteksi atau tidak ada.',
                ], 422);
            }
            // [CONFIG] Tangani expired approval_actual
            if ($e->getMessage() === 'APPROVAL_ACTUAL_EXPIRED') {
                return response()->json([
                    'success' => false,
                    'message' => 'Approval sudah tidak dapat dilakukan. Batas waktu approval call actual telah terlewat.'
                ], 422);
            }

            return response()->json([
                'success' => false,
                'message' => 'Gagal menyimpan approval: ' . $e->getMessage()
            ], 500);
        }
    }

   
    // Notifikasi Approval - Dipanggil saat app dibuka dan setiap 30 menit oleh ApprovalNotificationService.
    public function DmApprovalNotificationSummary(Request $req)
    {
        $idPegList = array_map('intval', $req->input('id_peg', []));
        $month     = (int) $req->input('month');
        $year      = (int) $req->input('year');

        if (empty($idPegList) || !$month || !$year) {
            return response()->json(['success' => false, 'message' => 'id_peg, month, year required'], 400);
        }

        $startDate = sprintf('%04d-%02d-01', $year, $month);
        $endDate   = date('Y-m-t', strtotime($startDate));
        $monthyear = date('Y-m-d'); 
        $now       = Carbon::now('Asia/Jakarta');

        $getjabatan = DB::table('data_pegawai')
            ->select(DB::raw('group_concat(distinct jabatan) as jabatan'))
            ->whereIn('rowid', $idPegList)->first();
        $jabatan = $getjabatan->jabatan ?? '';

        // Gabung 2 query call_setting menjadi 1 query tunggal.
        $callSettings = DB::table('call_setting as a')
            ->join('data_pegawai as b', 'a.user', '=', 'b.id_user')
            ->select('b.rowid', 'a.jumlah', 'a.input_set')
            ->whereIn('b.rowid', $idPegList)
            ->whereIn('a.input_set', ['Approval Call List', 'Approval Actual'])
            ->get()->keyBy('input_set');
        $cekList   = $callSettings->get('Approval Call List');
        $cekActual = $callSettings->get('Approval Actual');

        // Cache hasil selama 5 menit (300 detik).
        $cacheKey = 'dm_notif_' . implode('_', $idPegList) . "_{$year}_{$month}_" . date('Ymd');
        $cacheTtl = 300; // 5 menit

        $result = Cache::remember($cacheKey, $cacheTtl, function () use (
            $idPegList, $month, $year, $startDate, $endDate, $monthyear, $now,
            $jabatan, $cekList, $cekActual
        ) {

            // 1. CALL LIST — hitung pending + deadline hari kerja ke-N
            $listCount    = 0;
            $listDeadline = null;
            $periodeAwal  = Carbon::createFromFormat('Y-m-d', $startDate, 'Asia/Jakarta');
            $batasHKList  = (self::BATAS_HARI_KERJA_LIST !== null && empty($cekList->rowid))
                ? self::BATAS_HARI_KERJA_LIST
                : ($cekList->jumlah ?? 20);
            $deadlineCL   = $this->hitungDeadlineHariKerja($periodeAwal, $batasHKList);
            $listDeadline = $deadlineCL->format('Y-m-d') . ' 23:59:59';

            $bulanPeriode = sprintf('%04d-%02d', $year, $month);
            $overrideCL   = !empty(self::OVERRIDE_BULAN_LIST) && trim(self::OVERRIDE_BULAN_LIST) === $bulanPeriode;
            $listExpired  = !$overrideCL && $now->copy()->startOfDay()->gt($deadlineCL->copy()->startOfDay());

            if (!$listExpired) {
                if (str_contains($jabatan, 'ACT. DM') || str_contains($jabatan, 'DM')) {
                    //  branch 1: MR di bawah DM ybs | branch 2: DM tanpa RSM+MM
                    $b1 = DB::table('call_list as cl')->select('cl.id')
                        ->join('struktur as s', 's.id_peg_mr', '=', 'cl.id_peg')
                        ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                        ->whereIn('s.id_peg_dm', $idPegList)->whereNull('cl.approval')
                        ->whereBetween('cl.periode', [$startDate, $endDate]);
                    $b2 = DB::table('call_list as cl')->select('cl.id')
                        ->join('struktur as s', 's.id_peg_dm', '=', 'cl.id_peg')
                        ->leftJoin('data_pegawai as rsm', 'rsm.rowid', '=', 's.id_peg_rsm')
                        ->leftJoin('data_pegawai as mm',  'mm.rowid',  '=', 's.id_peg_mm')
                        ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                        ->whereIn('s.id_peg_dm', $idPegList)->whereNull('cl.approval')
                        ->whereBetween('cl.periode', [$startDate, $endDate])
                        ->whereIn('rsm.status', ['Vacant', 'Dummy'])->whereIn('mm.status', ['Vacant', 'Dummy']);
                    $listCount = DB::selectOne(
                        'SELECT COUNT(*) as cnt FROM ((' . $b1->toSql() . ') UNION (' . $b2->toSql() . ')) as u',
                        array_merge($b1->getBindings(), $b2->getBindings())
                    )->cnt;

                } elseif (str_contains($jabatan, 'RSM')) {
                    // branch 1: DM | branch 2: MR (DM Vacant/Dummy) | branch 3: RSM (MM Vacant/Dummy)
                    $b1 = DB::table('call_list as cl')->select('cl.id')
                        ->join('struktur as s', 's.id_peg_dm', '=', 'cl.id_peg')
                        ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                        ->whereIn('s.id_peg_rsm', $idPegList)->whereNull('cl.approval')
                        ->whereBetween('cl.periode', [$startDate, $endDate]);
                    $b2 = DB::table('call_list as cl')->select('cl.id')
                        ->join('struktur as s', 's.id_peg_mr', '=', 'cl.id_peg')
                        ->leftJoin('data_pegawai as dm', 'dm.rowid', '=', 's.id_peg_dm')
                        ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                        ->whereIn('s.id_peg_rsm', $idPegList)->whereNull('cl.approval')
                        ->whereBetween('cl.periode', [$startDate, $endDate])
                        ->whereIn('dm.status', ['Vacant', 'Dummy']);
                    $b3 = DB::table('call_list as cl')->select('cl.id')
                        ->join('struktur as s', 's.id_peg_rsm', '=', 'cl.id_peg')
                        ->leftJoin('data_pegawai as mm', 'mm.rowid', '=', 's.id_peg_mm')
                        ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                        ->whereIn('s.id_peg_rsm', $idPegList)->whereNull('cl.approval')
                        ->whereBetween('cl.periode', [$startDate, $endDate])
                        ->whereIn('mm.status', ['Vacant', 'Dummy']);
                    $listCount = DB::selectOne(
                        'SELECT COUNT(*) as cnt FROM ((' . $b1->toSql() . ') UNION (' . $b2->toSql() . ') UNION (' . $b3->toSql() . ')) as u',
                        array_merge($b1->getBindings(), $b2->getBindings(), $b3->getBindings())
                    )->cnt;

                } elseif (str_contains($jabatan, 'MM')) {
                    //  branch 1: RSM | branch 2: MR (DM+RSM Vacant/Dummy) | branch 3: DM (RSM Vacant/Dummy)
                    $b1 = DB::table('call_list as cl')->select('cl.id')
                        ->join('struktur as s', 's.id_peg_rsm', '=', 'cl.id_peg')
                        ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                        ->whereIn('s.id_peg_mm', $idPegList)->whereNull('cl.approval')
                        ->whereBetween('cl.periode', [$startDate, $endDate]);
                    $b2 = DB::table('call_list as cl')->select('cl.id')
                        ->join('struktur as s', 's.id_peg_mr', '=', 'cl.id_peg')
                        ->leftJoin('data_pegawai as dm',  'dm.rowid',  '=', 's.id_peg_dm')
                        ->leftJoin('data_pegawai as rsm', 'rsm.rowid', '=', 's.id_peg_rsm')
                        ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                        ->whereIn('s.id_peg_mm', $idPegList)->whereNull('cl.approval')
                        ->whereBetween('cl.periode', [$startDate, $endDate])
                        ->whereIn('dm.status', ['Vacant', 'Dummy'])->whereIn('rsm.status', ['Vacant', 'Dummy']);
                    $b3 = DB::table('call_list as cl')->select('cl.id')
                        ->join('struktur as s', 's.id_peg_dm', '=', 'cl.id_peg')
                        ->leftJoin('data_pegawai as rsm', 'rsm.rowid', '=', 's.id_peg_rsm')
                        ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                        ->whereIn('s.id_peg_mm', $idPegList)->whereNull('cl.approval')
                        ->whereBetween('cl.periode', [$startDate, $endDate])
                        ->whereIn('rsm.status', ['Vacant', 'Dummy']);
                    $listCount = DB::selectOne(
                        'SELECT COUNT(*) as cnt FROM ((' . $b1->toSql() . ') UNION (' . $b2->toSql() . ') UNION (' . $b3->toSql() . ')) as u',
                        array_merge($b1->getBindings(), $b2->getBindings(), $b3->getBindings())
                    )->cnt;
                }
            }

            // ────────────────────────────────────────────────────────────────
            // 2. CALL PLAN — hitung pending + deadline jam BATAS_JAM_PLAN
            // ────────────────────────────────────────────────────────────────
            $planCount    = 0;
            $planDeadline = null;

            $tglPlanFilter = $now->format('Y-m-d');
            if (self::BATAS_JAM_PLAN !== null && $this->sudahLewatJam(self::BATAS_JAM_PLAN)) {
                $tglPlanFilter = $now->copy()->addDay()->format('Y-m-d');
            }
            $planDeadline = $tglPlanFilter . sprintf(' %02d:00:00', self::BATAS_JAM_PLAN ?? 10);

            if (str_contains($jabatan, 'ACT. DM') || str_contains($jabatan, 'DM')) {
                $b1 = DB::table('call_plan_actual as cl')->select('cl.id')
                    ->join('struktur as s', 's.id_peg_mr', '=', 'cl.id_peg')
                    ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                    ->whereIn('s.id_peg_dm', $idPegList)->whereNull('cl.approval')
                    ->whereNotNull('cl.tgl_plan')->whereBetween('cl.tgl_plan', [$startDate, $endDate])
                    ->where('cl.tgl_plan', '>=', $tglPlanFilter);
                $b2 = DB::table('call_plan_actual as cl')->select('cl.id')
                    ->join('struktur as s', 's.id_peg_dm', '=', 'cl.id_peg')
                    ->leftJoin('data_pegawai as rsm', 'rsm.rowid', '=', 's.id_peg_rsm')
                    ->leftJoin('data_pegawai as mm',  'mm.rowid',  '=', 's.id_peg_mm')
                    ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                    ->whereIn('s.id_peg_dm', $idPegList)->whereNull('cl.approval')
                    ->whereNotNull('cl.tgl_plan')->whereBetween('cl.tgl_plan', [$startDate, $endDate])
                    ->where('cl.tgl_plan', '>=', $tglPlanFilter)
                    ->whereIn('rsm.status', ['Vacant', 'Dummy'])->whereIn('mm.status', ['Vacant', 'Dummy']);
                $planCount = DB::selectOne(
                    'SELECT COUNT(*) as cnt FROM ((' . $b1->toSql() . ') UNION (' . $b2->toSql() . ')) as u',
                    array_merge($b1->getBindings(), $b2->getBindings())
                )->cnt;

            } elseif (str_contains($jabatan, 'RSM')) {
                $b1 = DB::table('call_plan_actual as cl')->select('cl.id')
                    ->join('struktur as s', 's.id_peg_dm', '=', 'cl.id_peg')
                    ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                    ->whereIn('s.id_peg_rsm', $idPegList)->whereNull('cl.approval')
                    ->whereNotNull('cl.tgl_plan')->whereBetween('cl.tgl_plan', [$startDate, $endDate])
                    ->where('cl.tgl_plan', '>=', $tglPlanFilter);
                $b2 = DB::table('call_plan_actual as cl')->select('cl.id')
                    ->join('struktur as s', 's.id_peg_mr', '=', 'cl.id_peg')
                    ->leftJoin('data_pegawai as dm', 'dm.rowid', '=', 's.id_peg_dm')
                    ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                    ->whereIn('s.id_peg_rsm', $idPegList)->whereNull('cl.approval')
                    ->whereNotNull('cl.tgl_plan')->whereBetween('cl.tgl_plan', [$startDate, $endDate])
                    ->where('cl.tgl_plan', '>=', $tglPlanFilter)
                    ->whereIn('dm.status', ['Vacant', 'Dummy']);
                $b3 = DB::table('call_plan_actual as cl')->select('cl.id')
                    ->join('struktur as s', 's.id_peg_rsm', '=', 'cl.id_peg')
                    ->leftJoin('data_pegawai as mm', 'mm.rowid', '=', 's.id_peg_mm')
                    ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                    ->whereIn('s.id_peg_rsm', $idPegList)->whereNull('cl.approval')
                    ->whereNotNull('cl.tgl_plan')->whereBetween('cl.tgl_plan', [$startDate, $endDate])
                    ->where('cl.tgl_plan', '>=', $tglPlanFilter)
                    ->whereIn('mm.status', ['Vacant', 'Dummy']);
                $planCount = DB::selectOne(
                    'SELECT COUNT(*) as cnt FROM ((' . $b1->toSql() . ') UNION (' . $b2->toSql() . ') UNION (' . $b3->toSql() . ')) as u',
                    array_merge($b1->getBindings(), $b2->getBindings(), $b3->getBindings())
                )->cnt;

            } elseif (str_contains($jabatan, 'MM')) {
                $b1 = DB::table('call_plan_actual as cl')->select('cl.id')
                    ->join('struktur as s', 's.id_peg_rsm', '=', 'cl.id_peg')
                    ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                    ->whereIn('s.id_peg_mm', $idPegList)->whereNull('cl.approval')
                    ->whereNotNull('cl.tgl_plan')->whereBetween('cl.tgl_plan', [$startDate, $endDate])
                    ->where('cl.tgl_plan', '>=', $tglPlanFilter);
                $b2 = DB::table('call_plan_actual as cl')->select('cl.id')
                    ->join('struktur as s', 's.id_peg_mr', '=', 'cl.id_peg')
                    ->leftJoin('data_pegawai as dm',  'dm.rowid',  '=', 's.id_peg_dm')
                    ->leftJoin('data_pegawai as rsm', 'rsm.rowid', '=', 's.id_peg_rsm')
                    ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                    ->whereIn('s.id_peg_mm', $idPegList)->whereNull('cl.approval')
                    ->whereNotNull('cl.tgl_plan')->whereBetween('cl.tgl_plan', [$startDate, $endDate])
                    ->where('cl.tgl_plan', '>=', $tglPlanFilter)
                    ->whereIn('dm.status', ['Vacant', 'Dummy'])->whereIn('rsm.status', ['Vacant', 'Dummy']);
                $b3 = DB::table('call_plan_actual as cl')->select('cl.id')
                    ->join('struktur as s', 's.id_peg_dm', '=', 'cl.id_peg')
                    ->leftJoin('data_pegawai as rsm', 'rsm.rowid', '=', 's.id_peg_rsm')
                    ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                    ->whereIn('s.id_peg_mm', $idPegList)->whereNull('cl.approval')
                    ->whereNotNull('cl.tgl_plan')->whereBetween('cl.tgl_plan', [$startDate, $endDate])
                    ->where('cl.tgl_plan', '>=', $tglPlanFilter)
                    ->whereIn('rsm.status', ['Vacant', 'Dummy']);
                $planCount = DB::selectOne(
                    'SELECT COUNT(*) as cnt FROM ((' . $b1->toSql() . ') UNION (' . $b2->toSql() . ') UNION (' . $b3->toSql() . ')) as u',
                    array_merge($b1->getBindings(), $b2->getBindings(), $b3->getBindings())
                )->cnt;
            }

            // ────────────────────────────────────────────────────────────────
            // 3. CALL ACTUAL — hitung pending + deadline jam BATAS_JAM_ACTUAL
            // ────────────────────────────────────────────────────────────────
            $actualCount    = 0;
            $actualDeadline = null;

            $extraDays = 0;
            if ($now->isSunday())     $extraDays = 2;
            elseif ($now->isMonday()) $extraDays = 3;

            $batasHariActual = (self::BATAS_HARI_ACTUAL !== null && empty($cekActual->rowid))
                                ? self::BATAS_HARI_ACTUAL
                                : ($cekActual->jumlah ?? self::BATAS_HARI_ACTUAL ?? 1);

            if (self::BATAS_JAM_ACTUAL !== null && $this->sudahLewatJam(self::BATAS_JAM_ACTUAL)) {
                $cutoffTglActual = $now->copy()->subDays(($batasHariActual - 1) + $extraDays)->format('Y-m-d');
            } else {
                $cutoffTglActual = $now->copy()->subDays($batasHariActual + $extraDays)->format('Y-m-d');
            }
            // Deadline = hari ini jam BATAS_JAM_ACTUAL (atau waktu aktual terdekat)
            $actualDeadline = $now->copy()->subDays($extraDays)->format('Y-m-d')
                . sprintf(' %02d:00:00', self::BATAS_JAM_ACTUAL ?? 11);

            if (str_contains($jabatan, 'ACT. DM') || str_contains($jabatan, 'DM')) {

                $b1 = DB::table('call_plan_actual as cl')->select('cl.id')
                    ->join('struktur as s', 's.id_peg_mr', '=', 'cl.id_peg')
                    ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                    ->whereIn('s.id_peg_dm', $idPegList)->whereNull('cl.approval_actual')
                    ->whereNotNull('cl.tgl_actual')->whereBetween('cl.tgl_actual', [$startDate, $endDate])
                    ->where('cl.tgl_actual', '>=', $cutoffTglActual);
                $b2 = DB::table('call_plan_actual as cl')->select('cl.id')
                    ->join('struktur as s', 's.id_peg_dm', '=', 'cl.id_peg')
                    ->leftJoin('data_pegawai as rsm', 'rsm.rowid', '=', 's.id_peg_rsm')
                    ->leftJoin('data_pegawai as mm',  'mm.rowid',  '=', 's.id_peg_mm')
                    ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                    ->whereIn('s.id_peg_dm', $idPegList)->whereNull('cl.approval_actual')
                    ->whereNotNull('cl.tgl_actual')->whereBetween('cl.tgl_actual', [$startDate, $endDate])
                    ->where('cl.tgl_actual', '>=', $cutoffTglActual)
                    ->whereIn('rsm.status', ['Vacant', 'Dummy'])->whereIn('mm.status', ['Vacant', 'Dummy']);
                $actualCount = DB::selectOne(
                    'SELECT COUNT(*) as cnt FROM ((' . $b1->toSql() . ') UNION (' . $b2->toSql() . ')) as u',
                    array_merge($b1->getBindings(), $b2->getBindings())
                )->cnt;

            } elseif (str_contains($jabatan, 'RSM')) {

                $b1 = DB::table('call_plan_actual as cl')->select('cl.id')
                    ->join('struktur as s', 's.id_peg_dm', '=', 'cl.id_peg')
                    ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                    ->whereIn('s.id_peg_rsm', $idPegList)->whereNull('cl.approval_actual')
                    ->whereNotNull('cl.tgl_actual')->whereBetween('cl.tgl_actual', [$startDate, $endDate])
                    ->where('cl.tgl_actual', '>=', $cutoffTglActual);
                $b2 = DB::table('call_plan_actual as cl')->select('cl.id')
                    ->join('struktur as s', 's.id_peg_mr', '=', 'cl.id_peg')
                    ->leftJoin('data_pegawai as dm', 'dm.rowid', '=', 's.id_peg_dm')
                    ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                    ->whereIn('s.id_peg_rsm', $idPegList)->whereNull('cl.approval_actual')
                    ->whereNotNull('cl.tgl_actual')->whereBetween('cl.tgl_actual', [$startDate, $endDate])
                    ->where('cl.tgl_actual', '>=', $cutoffTglActual)
                    ->whereIn('dm.status', ['Vacant', 'Dummy']);
                $b3 = DB::table('call_plan_actual as cl')->select('cl.id')
                    ->join('struktur as s', 's.id_peg_rsm', '=', 'cl.id_peg')
                    ->leftJoin('data_pegawai as mm', 'mm.rowid', '=', 's.id_peg_mm')
                    ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                    ->whereIn('s.id_peg_rsm', $idPegList)->whereNull('cl.approval_actual')
                    ->whereNotNull('cl.tgl_actual')->whereBetween('cl.tgl_actual', [$startDate, $endDate])
                    ->where('cl.tgl_actual', '>=', $cutoffTglActual)
                    ->whereIn('mm.status', ['Vacant', 'Dummy']);
                $actualCount = DB::selectOne(
                    'SELECT COUNT(*) as cnt FROM ((' . $b1->toSql() . ') UNION (' . $b2->toSql() . ') UNION (' . $b3->toSql() . ')) as u',
                    array_merge($b1->getBindings(), $b2->getBindings(), $b3->getBindings())
                )->cnt;

            } elseif (str_contains($jabatan, 'MM')) {

                $b1 = DB::table('call_plan_actual as cl')->select('cl.id')
                    ->join('struktur as s', 's.id_peg_rsm', '=', 'cl.id_peg')
                    ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                    ->whereIn('s.id_peg_mm', $idPegList)->whereNull('cl.approval_actual')
                    ->whereNotNull('cl.tgl_actual')->whereBetween('cl.tgl_actual', [$startDate, $endDate])
                    ->where('cl.tgl_actual', '>=', $cutoffTglActual);
                $b2 = DB::table('call_plan_actual as cl')->select('cl.id')
                    ->join('struktur as s', 's.id_peg_mr', '=', 'cl.id_peg')
                    ->leftJoin('data_pegawai as dm',  'dm.rowid',  '=', 's.id_peg_dm')
                    ->leftJoin('data_pegawai as rsm', 'rsm.rowid', '=', 's.id_peg_rsm')
                    ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                    ->whereIn('s.id_peg_mm', $idPegList)->whereNull('cl.approval_actual')
                    ->whereNotNull('cl.tgl_actual')->whereBetween('cl.tgl_actual', [$startDate, $endDate])
                    ->where('cl.tgl_actual', '>=', $cutoffTglActual)
                    ->whereIn('dm.status', ['Vacant', 'Dummy'])->whereIn('rsm.status', ['Vacant', 'Dummy']);
                $b3 = DB::table('call_plan_actual as cl')->select('cl.id')
                    ->join('struktur as s', 's.id_peg_dm', '=', 'cl.id_peg')
                    ->leftJoin('data_pegawai as rsm', 'rsm.rowid', '=', 's.id_peg_rsm')
                    ->whereRaw('? BETWEEN s.periode_awal AND s.periode_akhir', [$monthyear])
                    ->whereIn('s.id_peg_mm', $idPegList)->whereNull('cl.approval_actual')
                    ->whereNotNull('cl.tgl_actual')->whereBetween('cl.tgl_actual', [$startDate, $endDate])
                    ->where('cl.tgl_actual', '>=', $cutoffTglActual)
                    ->whereIn('rsm.status', ['Vacant', 'Dummy']);
                $actualCount = DB::selectOne(
                    'SELECT COUNT(*) as cnt FROM ((' . $b1->toSql() . ') UNION (' . $b2->toSql() . ') UNION (' . $b3->toSql() . ')) as u',
                    array_merge($b1->getBindings(), $b2->getBindings(), $b3->getBindings())
                )->cnt;
            }

            return [
                'list_count'     => $listCount,
                'plan_count'     => $planCount,
                'actual_count'   => $actualCount,
                'list_deadline'  => $listDeadline,
                'plan_deadline'  => $planDeadline,
                'actual_deadline' => $actualDeadline,
            ];
        }); // end Cache::remember

        return response()->json([
            'success' => true,
            'data' => [
                'list_count'       => $result['list_count'],
                'plan_count'       => $result['plan_count'],
                'actual_count'     => $result['actual_count'],
                'list_deadline'    => $result['list_deadline'],
                'plan_deadline'    => $result['plan_deadline'],
                'actual_deadline'  => $result['actual_deadline'],
                'interval_minutes' => self::NOTIFICATION_INTERVAL_MINUTES,
            ]
        ]);
    }
}// end
