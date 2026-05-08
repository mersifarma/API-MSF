<?php

use Illuminate\Http\Request;
use App\Models\data_dokter;
use App\Models\AppModul;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Api\ImageController;
use App\Http\Controllers\Api\VisitController; // PROD ← aktif
use App\Http\Controllers\Api\VisitController_dev;   // tetap di-import untuk route group prefix('dev')
use App\Http\Controllers\Api\JoinVisitController;
use App\Http\Controllers\Api\VisitApprovalController;
use App\Http\Controllers\Api\MainMenuController;

//upload photo
Route::post('/upload-photo', [ImageController::class, 'uploadPhoto']);

//save photo to db
Route::post('/actual-save-photo', [ImageController::class, 'savePhoto']);

//save signature to db
Route::post('/actual-save-signature', [ImageController::class, 'saveSignature']);

// main menu ---------------------------------------------------------
//login
Route::post('/login', [MainMenuController::class, 'login']);

//get server date
Route::get('/server-date', function () {
    return response()->json([
        'date' => now()->toIso8601String()
    ]);
});

//  Cek versi aplikasi Flutter vs versi di database (tabel call_version)
Route::get('/app-version', [VisitController::class, 'getAppVersion']);

//show modul all
Route::get('/modul-all', function () {
    $query = AppModul::all();

    return response()->json([
        'success' => true,
        'data' => $query
    ]);
});

//get modul name by user
Route::get('/modul-user/{id_user}', [MainMenuController::class, 'getModulesByUser']);


// visit modul -------------------------------------------------------------------------------------
//get master customer list
Route::post('/doctor-list', [VisitController::class, 'doctorList']);

//get speciality
Route::get('/doctor-spec', function () {
    $specs = DB::table('data_spec_dr')->pluck('spec');

    return response()->json([
        'success' => true,
        'data' => $specs
    ]);
});

//display call list
Route::post('/call-list-data', [VisitController::class, 'displayCallList']);

//input doctor call list
Route::post('/call-list-get', [VisitController::class, 'getCallList']);

Route::post('/call-list-data', [VisitController::class, 'getCallListData']);

//call list count limit
Route::post('/call-list-count', [VisitController::class, 'getMonthlyCount']);

//save call list
Route::post('/call-list-save', [VisitController::class, 'saveCallList']);

//Edit Call list - History call list 
Route::post('/call-list-update', [VisitController::class, 'updateCallList']);
Route::post('/call-list-history', [VisitController::class, 'getCallListHistory']);

//display call plan
Route::post('/call-plan-data', [VisitController::class, 'displayCallPlan']);

//input doctor call plan
Route::post('/call-plan-doctor', [VisitController::class, 'callPlanDoctor']);

//get location doctor plan
Route::post('/call-plan-inst', [VisitController::class, 'callPlanInst']);

//save call plan
Route::post('/call-plan-save', [VisitController::class, 'saveCallPlan']);

//get product list untuk dipilih saat add call plan
Route::get('/get-product-list', [VisitController::class, 'getProductList']);

//get actual details
Route::get('/call-actual-details/{id}', [VisitController::class, 'getActualDetails']);

//save planned actual
Route::post('/call-actual-save', [VisitController::class, 'saveActual']);

//display call actual
Route::post('/call-actual-data', [VisitController::class, 'displayActual']);

//save unplanned/non-target actual
Route::post('/unplan-actual-save', [VisitController::class, 'saveUnplanned']);

//get non-target data
Route::post('/nt-get-data', [VisitController::class, 'getNtData']);

//get user data
Route::post('/get-ff-data', [VisitController::class, 'getFFname']);

//get data call report
Route::post('/get-call-report', [VisitController::class, 'getCallReport']);

// DELETE CALL PLAN - Endpoint untuk menghapus data dari call plan
Route::post('/call-plan-delete', [VisitController::class, 'deleteCallPlan']);

//  DELETE CALL LIST - Endpoint untuk menghapus data dari call list
Route::post('/call-list-delete', [VisitController::class, 'deleteCallList']);

//get reach prod report
Route::post('/get-report-reach-prod', [VisitController::class, 'getReachProdReport']);

//get freq report
Route::post('/get-report-freq', [VisitController::class, 'getFreqReport']);

// Endpoint untuk mendapatkan jumlah hari kerja dari database report
// Digunakan untuk menghitung target Call Productivity dinamis
Route::post('/get-working-days', [VisitController::class, 'getWorkingDays']);
// target productivity dari call_target_hari (dinamis, bukan hardcode)
Route::post('/get-productivity-target', [VisitController::class, 'getProductivityTarget']);


//approval
// approval list muncul nama bawahan
Route::post('/dm-approval-list-name', [VisitApprovalController::class, 'DmApprovalListName']);

// approval list details
Route::post('/dm-approval-list-details', [VisitApprovalController::class, 'DmApprovalListDetails']);

//save approval list
Route::post('/dm-approval-list-save', [VisitApprovalController::class, 'DmApprovalListSave']);

// ============================================================================
// APPROVAL CALL PLAN - approval untuk tgl_plan di call_plan_actual
// ============================================================================
Route::post('/dm-approval-plan-name', [VisitApprovalController::class, 'DmApprovalPlanName']);
Route::post('/dm-approval-plan-details', [VisitApprovalController::class, 'DmApprovalPlanDetails']);
Route::post('/dm-approval-plan-save', [VisitApprovalController::class, 'DmApprovalPlanSave']);

// ============================================================================
// APPROVAL CALL ACTUAL - approval untuk tgl_actual di call_plan_actual
// ============================================================================
Route::post('/dm-approval-actual-name', [VisitApprovalController::class, 'DmApprovalActualName']);
Route::post('/dm-approval-actual-details', [VisitApprovalController::class, 'DmApprovalActualDetails']);
Route::post('/dm-approval-actual-save', [VisitApprovalController::class, 'DmApprovalActualSave']);

// Endpoint untuk approval actual satu-satu (single item approval)- Digunakan dari halaman view_approval_actual_detail_page.dart
Route::post('/dm-approval-actual-single', [VisitApprovalController::class, 'DmApprovalActualSingle']);

// Endpoint notifikasi approval — dipanggil oleh ApprovalNotificationService di Flutter
// Mengembalikan jumlah pending (list+plan+actual) + info deadline
Route::post('/dm-approval-notification-summary', [VisitApprovalController::class, 'DmApprovalNotificationSummary']);

// Endpoint notifikasi untuk MR — berapa call list milik user yang masih pending approval DM
// Dibaca oleh ApprovalNotificationService bersamaan dengan dm-approval-notification-summary
Route::post('/get-my-pending-call-list-count', [VisitController::class, 'getMyPendingCallListCount']);


// ============================================================================
// Target berdasarkan jabatan user yang login (dokter + non_dokter = total)
// ============================================================================
Route::post('/get-call-list-target', [VisitController::class, 'getCallListTarget']);

// unvisit ============================================================================
Route::get('/get-unvisit-alasan',  [VisitController::class, 'getUnvisitAlasan']);
// config batas tanggal unvisit dikelola di controller
Route::get('/get-unvisit-config',  [VisitController::class, 'getUnvisitConfig']);
Route::post('/add-unvisit',        [VisitController::class, 'addUnvisit']);
Route::post('/get-unvisit-list',   [VisitController::class, 'getUnvisitList']);
Route::post('/delete-unvisit',     [VisitController::class, 'deleteUnvisit']);

// offline ============================================================================
//offline call plan
Route::post('/offline-call-plan', [VisitController::class, 'offlineCallPlan']);

//sync offline to server
Route::post('/offline-call-plan', [VisitController::class, 'offlineCallPlan']);

// join visit ============================================================================
// Konfigurasi radius join visit — dikontrol dari JoinVisitController::JOIN_VISIT_RADIUS_METERS
// Dulu hardcode di location_function.dart. Sekarang dibaca dari sini tanpa update app.
Route::get('/get-app-config', [JoinVisitController::class, 'getAppConfig']);

//call atasan
Route::post('/call-join-visit', [JoinVisitController::class, 'callJoinVisit']);

//approval atasan
Route::post('/approval-join-visit', [JoinVisitController::class, 'approvalJoinVisit']);

// [Join Visit] Daftar join visit pending untuk atasan (belum input lokasi)
// Route::post('/join-visit-list', [JoinVisitController::class, 'getJoinVisitList']);

// // [Join Visit] Atasan simpan lokasi + validasi 100m dari MR
// Route::post('/join-visit-save-location', [JoinVisitController::class, 'saveJoinVisitLocation']);
Route::post('/approval-join-details', [JoinVisitController::class, 'joinVisitDetails']);

//copy join visit
Route::post('/copy-join-visit', [JoinVisitController::class, 'copyJoinVisit']);

// UNTUK DEV/TESTING DI SERVER, TIDAK UNTUK PRODUCTION// ============================================================================
// DEV ENVIRONMENT - Akses via: /api/dev/...
// Shared routes (login, approval, join-visit, dll) → tetap pakai controller prod
// Visit routes → pakai VisitController_dev
// ============================================================================
Route::prefix('dev')->group(function () {

    // --- shared: upload foto & signature (sama dengan prod) ---
    Route::post('/upload-photo',           [ImageController::class, 'uploadPhoto']);
    Route::post('/actual-save-photo',      [ImageController::class, 'savePhoto']);
    Route::post('/actual-save-signature',  [ImageController::class, 'saveSignature']);

    // --- shared: main menu (sama dengan prod) ---
    Route::post('/login',                  [MainMenuController::class, 'login']);
    Route::get('/server-date', function () {
        return response()->json(['date' => now()->toIso8601String()]);
    });
    Route::get('/modul-all', function () {
        return response()->json(['success' => true, 'data' => AppModul::all()]);
    });
    Route::get('/modul-user/{id_user}',    [MainMenuController::class, 'getModulesByUser']);
    Route::get('/doctor-spec', function () {
        return response()->json(['success' => true, 'data' => DB::table('data_spec_dr')->pluck('spec')]);
    });

    // --- shared: approval (sama dengan prod) ---
    Route::post('/dm-approval-list-name',     [VisitApprovalController::class, 'DmApprovalListName']);
    Route::post('/dm-approval-list-details',  [VisitApprovalController::class, 'DmApprovalListDetails']);
    Route::post('/dm-approval-list-save',     [VisitApprovalController::class, 'DmApprovalListSave']);
    Route::post('/dm-approval-plan-name',     [VisitApprovalController::class, 'DmApprovalPlanName']);
    Route::post('/dm-approval-plan-details',  [VisitApprovalController::class, 'DmApprovalPlanDetails']);
    Route::post('/dm-approval-plan-save',     [VisitApprovalController::class, 'DmApprovalPlanSave']);
    Route::post('/dm-approval-actual-name',   [VisitApprovalController::class, 'DmApprovalActualName']);
    Route::post('/dm-approval-actual-details',[VisitApprovalController::class, 'DmApprovalActualDetails']);
    Route::post('/dm-approval-actual-save',   [VisitApprovalController::class, 'DmApprovalActualSave']);
    Route::post('/dm-approval-actual-single', [VisitApprovalController::class, 'DmApprovalActualSingle']);

    // --- shared: join visit (sama dengan prod) ---
    Route::post('/call-join-visit',        [JoinVisitController::class, 'callJoinVisit']);
    Route::post('/approval-join-visit',    [JoinVisitController::class, 'approvalJoinVisit']);
    Route::post('/approval-join-details',  [JoinVisitController::class, 'joinVisitDetails']);
    Route::post('/copy-join-visit',        [JoinVisitController::class, 'copyJoinVisit']);

    // --- DEV: visit routes → VisitController_dev ---
    Route::get('/app-version',             [VisitController_dev::class, 'getAppVersion']);
    Route::post('/doctor-list',            [VisitController_dev::class, 'doctorList']);
    Route::post('/call-list-data',         [VisitController_dev::class, 'displayCallList']);
    Route::post('/call-list-get',          [VisitController_dev::class, 'getCallList']);
    Route::post('/call-list-count',        [VisitController_dev::class, 'getMonthlyCount']);
    Route::post('/call-list-save',         [VisitController_dev::class, 'saveCallList']);
    // Edit & History call list di dev environment
    Route::post('/call-list-update',       [VisitController::class, 'updateCallList']);
    Route::post('/call-list-history',      [VisitController::class, 'getCallListHistory']);
    Route::post('/call-plan-data',         [VisitController_dev::class, 'displayCallPlan']);
    Route::post('/call-plan-doctor',       [VisitController_dev::class, 'callPlanDoctor']);
    Route::post('/call-plan-inst',         [VisitController_dev::class, 'callPlanInst']);
    Route::post('/call-plan-save',         [VisitController_dev::class, 'saveCallPlan']);
    Route::get('/call-actual-details/{id}',[VisitController_dev::class, 'getActualDetails']);
    Route::post('/call-actual-save',       [VisitController_dev::class, 'saveActual']);
    Route::post('/call-actual-data',       [VisitController_dev::class, 'displayActual']);
    Route::post('/unplan-actual-save',     [VisitController_dev::class, 'saveUnplanned']);
    Route::post('/nt-get-data',            [VisitController_dev::class, 'getNtData']);
    Route::post('/get-ff-data',            [VisitController_dev::class, 'getFFname']);
    Route::post('/get-call-report',        [VisitController_dev::class, 'getCallReport']);
    Route::post('/call-plan-delete',       [VisitController_dev::class, 'deleteCallPlan']);
    Route::post('/call-list-delete',       [VisitController_dev::class, 'deleteCallList']);
    Route::post('/get-report-reach-prod',  [VisitController_dev::class, 'getReachProdReport']);
    Route::post('/get-report-freq',        [VisitController_dev::class, 'getFreqReport']);
    Route::post('/get-working-days',       [VisitController_dev::class, 'getWorkingDays']);
    // productivity target dinamis
    Route::post('/get-productivity-target',   [VisitController::class,     'getProductivityTarget']);
    Route::post('/get-call-list-target',      [VisitController_dev::class, 'getCallListTarget']);
    Route::post('/offline-call-plan',      [VisitController_dev::class, 'offlineCallPlan']);
    // unvisit (pakai prod controller — shared)
    Route::get('/get-unvisit-alasan',      [VisitController::class, 'getUnvisitAlasan']);
    //config batas tanggal unvisit
    Route::get('/get-unvisit-config',      [VisitController::class, 'getUnvisitConfig']);
    Route::post('/add-unvisit',            [VisitController::class, 'addUnvisit']);
    Route::post('/get-unvisit-list',       [VisitController::class, 'getUnvisitList']);
    Route::post('/delete-unvisit',         [VisitController::class, 'deleteUnvisit']);

}); // tutup Route::prefix('dev')
