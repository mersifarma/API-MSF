<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Models\AppModul;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Hash;

class MainMenuController extends Controller
{
    //login
    public function login(Request $request)
    {
        $user = DB::table('users')->where('username', $request->username)->first(); 

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Incorrect username/password.'
            ]);
        }

        if (!Hash::check($request->password, $user->password)) {   
            return response()->json([
                'success' => false,
                'message' => 'Incorrect username/password.'
            ]);
        }

        //  Ambil data pegawai termasuk divisi dan jabatan
        // Query dengan IFNULL untuk status (Exist atau NULL = aktif)
        $pegawai = DB::table('data_pegawai')
            ->where('id_user', $user->id)
            ->whereRaw('IFNULL(status, "Exist") = "Exist"')
            ->select('rowid', 'id', 'divisi', 'jabatan')
            ->get();

        $rowidList = $pegawai->pluck('rowid')->toArray();
        $idList = $pegawai->pluck('id')->toArray();

        // Ambil divisi dan jabatan pertama dari data pegawai
        // Asumsi: 1 user = 1 divisi dan 1 jabatan (ambil yang pertama jika ada multiple)
        // $divisi = $pegawai->first()->divisi ?? '';
        $divisiList  = $pegawai->pluck('divisi')->filter()->unique()->values()->toArray();
        $divisi = implode(',', $divisiList);
        $jabatan = $pegawai->first()->jabatan ?? '';

     
        //  Kirim divisi dan jabatan ke mobile app
        // - divisi: untuk filter tampilan Call Reach (Neptune vs Non-Neptune)
        // - jabatan: untuk menentukan target Call Reach (MR/PS/KAE, DM, RSM)
        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'user' => [
                'id' => $user->id,
                'username' => $user->username,
                'name' => $user->name,
                'role' => $user->role ?? 'user',
                'id_peg' => $rowidList,
                'id_ff' => $idList,
                'divisi' => $divisi,   // Divisi untuk breakdown dokter/non-dokter
                'jabatan' => $jabatan, // Jabatan untuk target dinamis
            ],
        ]);
    }

    // app role
    public function getModulesByUser($id_user) 
    {
        $query = DB::table('app_role_menu as arm')
            ->join('app_modul as am', 'arm.id_modul', '=', 'am.id_modul')
            ->where('arm.id_user', $id_user)
            ->select('am.id_modul', 'am.nama_modul', 'am.icons2')
            ->distinct()
            ->get();

        return response()->json([
            'success' => true,
            'modules' => $query
        ]);
    }
} //end
