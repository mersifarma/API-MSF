<?php

namespace App\Http\Controllers\Api;

use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Models\list_dokter_visit;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class JoinVisitController extends Controller
{
    // ============================================================================
    // [Join Visit] callJoinVisit
    // Dipanggil oleh MR untuk mendapatkan daftar atasan (DM/RSM)
    // yang bisa dipilih untuk Join Visit
    // ============================================================================

    public function callJoinVisit(Request $req)
    {
        $idPegList = json_decode($req->input('id_peg'), true);

        // Ambil jabatan
        $getjabatan = DB::table('data_pegawai')
            ->select(DB::raw('GROUP_CONCAT(DISTINCT jabatan) as jabatan'))
            ->whereIn('rowid', $idPegList)
            ->first();

        $jabatan = $getjabatan->jabatan ?? '';

        // =========================
        // CASE: DM
        // =========================
        if (str_contains($jabatan, 'ACT. DM') || str_contains($jabatan, 'DM')) {

            $struktur = DB::table('struktur')
                ->select(DB::raw("
                    GROUP_CONCAT(DISTINCT id_peg_rsm) as rsm_ids
                "))
                ->whereIn('id_peg_dm', $idPegList)
                ->whereDate('periode_awal', '<=', now())
                ->whereDate('periode_akhir', '>=', now())
                ->first();

            if (!$struktur || !$struktur->rsm_ids) {
                return response()->json(['message' => 'DM not found'], 404);
            }

            // Pecah hasil concat
            $rsmIds = explode(',', $struktur->rsm_ids);

            $atasan = DB::table('data_pegawai')
                ->whereIn('rowid', $rsmIds)
                ->select('rowid', 'nama')
                ->get();

            return response()->json([
                'role' => 'DM',
                'atasan' => $atasan
            ]);
        }

        // =========================
        // CASE: MR
        // =========================
        else {

            $struktur = DB::table('struktur')
                ->select(DB::raw("
                    GROUP_CONCAT(DISTINCT id_peg_dm) as dm_ids,
                    GROUP_CONCAT(DISTINCT id_peg_rsm) as rsm_ids
                "))
                ->whereIn('id_peg_mr', $idPegList)
                ->whereDate('periode_awal', '<=', now())
                ->whereDate('periode_akhir', '>=', now())
                ->first();

            if (!$struktur || (!$struktur->dm_ids && !$struktur->rsm_ids)) {
                return response()->json(['message' => 'MR not found'], 404);
            }

            // Pecah hasil concat
            $dmIds  = $struktur->dm_ids ? explode(',', $struktur->dm_ids) : [];
            $rsmIds = $struktur->rsm_ids ? explode(',', $struktur->rsm_ids) : [];

            // Gabungkan & hilangkan duplikat
            $atasanIds = array_unique(array_merge($dmIds, $rsmIds));

            $atasan = DB::table('data_pegawai')
                ->whereIn('rowid', $atasanIds)
                ->select('rowid', 'nama')
                ->get();

            return response()->json([
                'role' => 'MR',
                'atasan' => $atasan
            ]);
        }
    }

    //panggilan atasan untuk approval join visit
    public function approvalJoinVisit(Request $req)
    {
        date_default_timezone_set('Asia/Jakarta');  

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

        $startDate = sprintf('%04d-%02d-01', $year, $month);
        $endDate   = date('Y-m-t', strtotime($startDate));

        $cekvisit = DB::table('call_plan_actual as cl')
        ->select(
                DB::raw('GROUP_CONCAT(distinct cl.join_visit_id) as join_visit_id')
            )
            ->whereNotNull('cl.join_visit_id') 
            ->where(function ($q) use ($idPegList) {   // <----- check approver id
                foreach ($idPegList as $id) {
                    $q->orWhereRaw("FIND_IN_SET(?, cl.join_visit_ff)", [$id]);  // <-----
                }
            })->first();

        $employees = DB::table('call_plan_actual as cl')
            ->join('data_pegawai as dp', 'dp.rowid', '=', 'cl.id_peg')
            ->where('cl.join_visit', 1)  
            ->where(function ($q) use ($idPegList) {   // <----- check approver id
                foreach ($idPegList as $id) {
                    $q->orWhereRaw("FIND_IN_SET(?, cl.join_visit_ff)", [$id]);  // <-----
                }
            })
            // ->whereNull('cl.approval_actual')
            ->whereNotIn('cl.id', explode(',', $cekvisit->join_visit_id))
            ->whereNotNull('cl.tgl_actual')
            ->whereBetween('cl.tgl_actual', [$startDate, $endDate])
            ->whereRaw('cl.updated_date >= NOW() - INTERVAL 30 MINUTE') //setting waktu join visit

            ->select(
                'dp.rowid as id_peg',
                'dp.nama as nama_pegawai',
                DB::raw('COUNT(DISTINCT cl.id) as total_request')
            )
            ->groupBy('dp.rowid', 'dp.nama')
            ->orderBy('dp.nama')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $employees
        ]);
    }

    public function joinVisitDetails(Request $req)
    {
        $idPeg = $req->input('id_peg');
        $month = $req->input('month');
        $year  = $req->input('year');
        $approverId = $req->input('approver_id');   // approver (DM/RSM)
        // $approverId = array_map('intval', $req->input('approver_id', []));

        if (!$idPeg || !$month || !$year) {
            return response()->json([
                'success' => false,
                'message' => 'id_peg, month, and year are required'
            ], 400);
        }

        // Build date range
        $startDate = sprintf('%04d-%02d-01', $year, $month);
        $endDate   = date('Y-m-t', strtotime($startDate));
        $cekuser = DB::table('data_pegawai')->select('id_user')->where('rowid', $approverId)->first();
        $cekpegawai = DB::table('data_pegawai')->select(DB::raw('group_concat(distinct rowid) as id_peg'))
        ->where('id_user', $cekuser->id_user)
        ->where(DB::raw('ifnull(status,"Exist")'),'Exist')->first();


        $cekvisit = DB::table('call_plan_actual as cl')
        ->select(
                DB::raw('GROUP_CONCAT(distinct cl.join_visit_id) as join_visit_id')
            )
            ->whereNotNull('cl.join_visit_id')
            // ->whereRaw("FIND_IN_SET(?, cl.join_visit_ff)", [$approverId])
            ->where(function ($q) use ($cekpegawai) {
                foreach (explode(',', $cekpegawai->id_peg) as $id) {
                    $q->orWhereRaw("FIND_IN_SET(?, cl.join_visit_ff)", [$id]);
                }
            })
            ->first();
        $requests = DB::table('call_plan_actual as cpa')
            ->where('cpa.id_peg', $idPeg)
            ->where('cpa.join_visit', 1)

            // ->whereRaw("FIND_IN_SET(?, cpa.join_visit_ff)", [$approverId])   // <-- filter approver
            ->where(function ($q) use ($cekpegawai) {
                foreach (explode(',', $cekpegawai->id_peg) as $id) {
                    $q->orWhereRaw("FIND_IN_SET(?, cpa.join_visit_ff)", [$id]);
                }
            })
            // ->whereNull('cpa.approval_actual')
            ->whereNotIn('cpa.id', explode(',', $cekvisit->join_visit_id))
            ->whereNotNull('cpa.tgl_actual')
            ->whereBetween('cpa.tgl_actual', [$startDate, $endDate])
            ->whereRaw('cpa.updated_date >= NOW() - INTERVAL 30 MINUTE') //setting waktu join visit
            // ->whereRaw('cpa.updated_date >= NOW() - INTERVAL 5 DAY')

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
                'cpa.foto'
            )
            ->orderBy('cpa.tgl_actual')
            ->orderBy('cpa.waktu_actual')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $requests
        ]);
    }

    private function joinVisitCopyData($actualId, $approverPegId, $koorVisit)
    {
        // 1. Get MR data
        $actual = DB::table('call_plan_actual')
            ->where('id', $actualId)
            ->first();

        if (!$actual) return;

        // 2. Get approver (DM / RSM)
        $approver = DB::table('data_pegawai')
            ->where('rowid', $approverPegId)
            ->first();

        if (!$approver) return;

        $data = (array) $actual;

        // 3. Remove primary key
        unset($data['id']);

        // 4. Replace with approver data
        $data['id_peg']  = $approver->rowid;
        $data['id_ff']   = $approver->id;
        $data['nama_ff'] = $approver->nama;

        // 5. Reset approval fields
        $data['approval_actual'] = null;
        $data['approval_actual_by'] = null;
        $data['approval_actual_date'] = null;
        $data['approval_actual_comment'] = null;

        // 6. IMPORTANT: keep join_visit_id (no change)
        $data['join_visit_ff'] = $approver->rowid;

        // 7. Set join_visit = 0
        $data['join_visit'] = 0;
        $data['join_visit_id'] = $actualId;
        // $data['koor_visit'] = $koorVisit ?? $actual->koor_visit;

        // 8. Insert new row
        DB::table('call_plan_actual')->insert($data);
    }

    public function copyJoinVisit(Request $req)
    {
        $id = $req->input('id');
        $idPeg = $req->input('id_peg');
        $koorVisit = $req->input('koor_visit');

        if (!$id || !$idPeg) {
            return response()->json([
                'success' => false,
                'message' => 'id dan id_peg wajib diisi'
            ], 400);
        }

        try {
            $this->joinVisitCopyData($id, $idPeg, $koorVisit);

            return response()->json([
                'success' => true,
                'message' => 'Copy berhasil'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal copy: ' . $e->getMessage()
            ], 500);
        }
    }
}