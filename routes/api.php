<?php

use App\Models\AppModul;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;

// ─── PROD Controllers ────────────────────────────────────────────────────────
use App\Http\Controllers\Api\ImageController;
use App\Http\Controllers\Api\MainMenuController;
use App\Http\Controllers\Api\VisitController;
use App\Http\Controllers\Api\VisitApprovalController;
use App\Http\Controllers\Api\JoinVisitController;
use App\Http\Controllers\Api\S3PresignedController;

// ─── DEV Controllers  (prefix /api/dev) ──────────────────────────────────────
use App\Http\Controllers\Api\ImageController_dev;
use App\Http\Controllers\Api\MainMenuController_dev;
use App\Http\Controllers\Api\VisitController_dev;
use App\Http\Controllers\Api\VisitApprovalController_dev;
use App\Http\Controllers\Api\JoinVisitController_dev;
use App\Http\Controllers\Api\S3PresignedController_dev;

// ============================================================================
// PRODUCTION  —  /api/...
// ============================================================================

// ─── Main Menu ───────────────────────────────────────────────────────────────
Route::post('/login',               [MainMenuController::class, 'login']);
Route::get('/server-date', function () {
    return response()->json(['date' => now()->toIso8601String()]);
});
Route::get('/app-version',          [VisitController::class, 'getAppVersion']);
Route::get('/modul-all', function () {
    return response()->json(['success' => true, 'data' => AppModul::all()]);
});
Route::get('/modul-user/{id_user}', [MainMenuController::class, 'getModulesByUser']);

// ─── Call List ───────────────────────────────────────────────────────────────
Route::post('/doctor-list',                    [VisitController::class, 'doctorList']);
Route::get('/doctor-spec', function () {
    return response()->json(['success' => true, 'data' => DB::table('data_spec_dr')->pluck('spec')]);
});
Route::post('/call-list-data',                 [VisitController::class, 'displayCallList']);
Route::post('/call-list-get',                  [VisitController::class, 'getCallList']);
Route::post('/call-list-count',                [VisitController::class, 'getMonthlyCount']);
Route::post('/call-list-save',                 [VisitController::class, 'saveCallList']);
Route::post('/call-list-update',               [VisitController::class, 'updateCallList']);
Route::post('/call-list-history',              [VisitController::class, 'getCallListHistory']);
Route::post('/call-list-delete',               [VisitController::class, 'deleteCallList']);
Route::post('/get-call-list-target',           [VisitController::class, 'getCallListTarget']);
Route::post('/get-my-pending-call-list-count', [VisitController::class, 'getMyPendingCallListCount']);
Route::post('/get-ff-data',                    [VisitController::class, 'getFFname']);

// ─── Call Plan ───────────────────────────────────────────────────────────────
Route::post('/call-plan-data',    [VisitController::class, 'displayCallPlan']);
Route::post('/call-plan-doctor',  [VisitController::class, 'callPlanDoctor']);
Route::post('/call-plan-inst',    [VisitController::class, 'callPlanInst']);
Route::post('/call-plan-save',    [VisitController::class, 'saveCallPlan']);
Route::post('/call-plan-delete',  [VisitController::class, 'deleteCallPlan']);
Route::get('/get-product-list',   [VisitController::class, 'getProductList']);

// ─── Actual ──────────────────────────────────────────────────────────────────
Route::post('/upload-photo',             [ImageController::class, 'uploadPhoto']);
Route::post('/actual-save-photo',        [ImageController::class, 'savePhoto']);
Route::post('/actual-save-signature',    [ImageController::class, 'saveSignature']);
Route::get('/call-actual-details/{id}',  [VisitController::class, 'getActualDetails']);
Route::post('/call-actual-save',         [VisitController::class, 'saveActual']);
Route::post('/call-actual-data',         [VisitController::class, 'displayActual']);
Route::post('/unplan-actual-save',       [VisitController::class, 'saveUnplanned']);
Route::post('/nt-get-data',              [VisitController::class, 'getNtData']);

// ─── Report ──────────────────────────────────────────────────────────────────
Route::post('/get-call-report',         [VisitController::class, 'getCallReport']);
Route::post('/get-report-reach-prod',   [VisitController::class, 'getReachProdReport']);
Route::post('/get-report-freq',         [VisitController::class, 'getFreqReport']);
Route::post('/get-working-days',        [VisitController::class, 'getWorkingDays']);
Route::post('/get-productivity-target', [VisitController::class, 'getProductivityTarget']);

// ─── Approval ────────────────────────────────────────────────────────────────
// Approval Call List
Route::post('/dm-approval-list-name',    [VisitApprovalController::class, 'DmApprovalListName']);
Route::post('/dm-approval-list-details', [VisitApprovalController::class, 'DmApprovalListDetails']);
Route::post('/dm-approval-list-save',    [VisitApprovalController::class, 'DmApprovalListSave']);
// Approval Call Plan
Route::post('/dm-approval-plan-name',    [VisitApprovalController::class, 'DmApprovalPlanName']);
Route::post('/dm-approval-plan-details', [VisitApprovalController::class, 'DmApprovalPlanDetails']);
Route::post('/dm-approval-plan-save',    [VisitApprovalController::class, 'DmApprovalPlanSave']);
// Approval Call Actual
Route::post('/dm-approval-actual-name',          [VisitApprovalController::class, 'DmApprovalActualName']);
Route::post('/dm-approval-actual-details',       [VisitApprovalController::class, 'DmApprovalActualDetails']);
Route::post('/dm-approval-actual-save',          [VisitApprovalController::class, 'DmApprovalActualSave']);
Route::post('/dm-approval-actual-single',        [VisitApprovalController::class, 'DmApprovalActualSingle']);
Route::post('/dm-approval-notification-summary', [VisitApprovalController::class, 'DmApprovalNotificationSummary']);

// ─── Unvisit ─────────────────────────────────────────────────────────────────
Route::get('/get-unvisit-alasan',  [VisitController::class, 'getUnvisitAlasan']);
Route::get('/get-unvisit-config',  [VisitController::class, 'getUnvisitConfig']);
Route::post('/add-unvisit',        [VisitController::class, 'addUnvisit']);
Route::post('/get-unvisit-list',   [VisitController::class, 'getUnvisitList']);
Route::post('/delete-unvisit',     [VisitController::class, 'deleteUnvisit']);

// ─── Join Visit ──────────────────────────────────────────────────────────────
Route::get('/get-app-config',         [JoinVisitController::class, 'getAppConfig']);
Route::post('/call-join-visit',       [JoinVisitController::class, 'callJoinVisit']);
Route::post('/approval-join-visit',   [JoinVisitController::class, 'approvalJoinVisit']);
Route::post('/approval-join-details', [JoinVisitController::class, 'joinVisitDetails']);
Route::post('/copy-join-visit',       [JoinVisitController::class, 'copyJoinVisit']);

// ─── Offline ─────────────────────────────────────────────────────────────────
Route::post('/offline-call-plan', [VisitController::class, 'offlineCallPlan']);

// ─── S3 Object Storage ───────────────────────────────────────────────────────
Route::post('/s3/presigned-url',   [S3PresignedController::class, 'getPresignedUrl']);
Route::post('/s3/confirm-upload',  [S3PresignedController::class, 'confirmUpload']);
Route::delete('/s3/delete-object', [S3PresignedController::class, 'deleteObject']);


// ============================================================================
// DEV  —  /api/dev/...
// ============================================================================
Route::prefix('dev')->group(function () {

    // ─── Main Menu ───────────────────────────────────────────────────────────
    Route::post('/login',               [MainMenuController_dev::class, 'login']);
    Route::get('/server-date', function () {
        return response()->json(['date' => now()->toIso8601String()]);
    });
    Route::get('/app-version',          [VisitController_dev::class, 'getAppVersion']);
    Route::get('/modul-all', function () {
        return response()->json(['success' => true, 'data' => AppModul::all()]);
    });
    Route::get('/modul-user/{id_user}', [MainMenuController_dev::class, 'getModulesByUser']);

    // ─── Call List ───────────────────────────────────────────────────────────
    Route::post('/doctor-list',                    [VisitController_dev::class, 'doctorList']);
    Route::get('/doctor-spec', function () {
        return response()->json(['success' => true, 'data' => DB::table('data_spec_dr')->pluck('spec')]);
    });
    Route::post('/call-list-data',                 [VisitController_dev::class, 'displayCallList']);
    Route::post('/call-list-get',                  [VisitController_dev::class, 'getCallList']);
    Route::post('/call-list-count',                [VisitController_dev::class, 'getMonthlyCount']);
    Route::post('/call-list-save',                 [VisitController_dev::class, 'saveCallList']);
    Route::post('/call-list-update',               [VisitController_dev::class, 'updateCallList']);
    Route::post('/call-list-history',              [VisitController_dev::class, 'getCallListHistory']);
    Route::post('/call-list-delete',               [VisitController_dev::class, 'deleteCallList']);
    Route::post('/get-call-list-target',           [VisitController_dev::class, 'getCallListTarget']);
    Route::post('/get-my-pending-call-list-count', [VisitController_dev::class, 'getMyPendingCallListCount']);
    Route::post('/get-ff-data',                    [VisitController_dev::class, 'getFFname']);

    // ─── Call Plan ───────────────────────────────────────────────────────────
    Route::post('/call-plan-data',   [VisitController_dev::class, 'displayCallPlan']);
    Route::post('/call-plan-doctor', [VisitController_dev::class, 'callPlanDoctor']);
    Route::post('/call-plan-inst',   [VisitController_dev::class, 'callPlanInst']);
    Route::post('/call-plan-save',   [VisitController_dev::class, 'saveCallPlan']);
    Route::post('/call-plan-delete', [VisitController_dev::class, 'deleteCallPlan']);
    Route::get('/get-product-list',  [VisitController_dev::class, 'getProductList']);

    // ─── Actual ──────────────────────────────────────────────────────────────
    Route::post('/upload-photo',             [ImageController_dev::class, 'uploadPhoto']);
    Route::post('/actual-save-photo',        [ImageController_dev::class, 'savePhoto']);
    Route::post('/actual-save-signature',    [ImageController_dev::class, 'saveSignature']);
    Route::get('/call-actual-details/{id}',  [VisitController_dev::class, 'getActualDetails']);
    Route::post('/call-actual-save',         [VisitController_dev::class, 'saveActual']);
    Route::post('/call-actual-data',         [VisitController_dev::class, 'displayActual']);
    Route::post('/unplan-actual-save',       [VisitController_dev::class, 'saveUnplanned']);
    Route::post('/nt-get-data',              [VisitController_dev::class, 'getNtData']);

    // ─── Report ──────────────────────────────────────────────────────────────
    Route::post('/get-call-report',         [VisitController_dev::class, 'getCallReport']);
    Route::post('/get-report-reach-prod',   [VisitController_dev::class, 'getReachProdReport']);
    Route::post('/get-report-freq',         [VisitController_dev::class, 'getFreqReport']);
    Route::post('/get-working-days',        [VisitController_dev::class, 'getWorkingDays']);
    Route::post('/get-productivity-target', [VisitController_dev::class, 'getProductivityTarget']);

    // ─── Approval ────────────────────────────────────────────────────────────
    // Approval Call List
    Route::post('/dm-approval-list-name',    [VisitApprovalController_dev::class, 'DmApprovalListName']);
    Route::post('/dm-approval-list-details', [VisitApprovalController_dev::class, 'DmApprovalListDetails']);
    Route::post('/dm-approval-list-save',    [VisitApprovalController_dev::class, 'DmApprovalListSave']);
    // Approval Call Plan
    Route::post('/dm-approval-plan-name',    [VisitApprovalController_dev::class, 'DmApprovalPlanName']);
    Route::post('/dm-approval-plan-details', [VisitApprovalController_dev::class, 'DmApprovalPlanDetails']);
    Route::post('/dm-approval-plan-save',    [VisitApprovalController_dev::class, 'DmApprovalPlanSave']);
    // Approval Call Actual
    Route::post('/dm-approval-actual-name',          [VisitApprovalController_dev::class, 'DmApprovalActualName']);
    Route::post('/dm-approval-actual-details',       [VisitApprovalController_dev::class, 'DmApprovalActualDetails']);
    Route::post('/dm-approval-actual-save',          [VisitApprovalController_dev::class, 'DmApprovalActualSave']);
    Route::post('/dm-approval-actual-single',        [VisitApprovalController_dev::class, 'DmApprovalActualSingle']);
    Route::post('/dm-approval-notification-summary', [VisitApprovalController_dev::class, 'DmApprovalNotificationSummary']);

    // ─── Unvisit ─────────────────────────────────────────────────────────────
    Route::get('/get-unvisit-alasan',  [VisitController_dev::class, 'getUnvisitAlasan']);
    Route::get('/get-unvisit-config',  [VisitController_dev::class, 'getUnvisitConfig']);
    Route::post('/add-unvisit',        [VisitController_dev::class, 'addUnvisit']);
    Route::post('/get-unvisit-list',   [VisitController_dev::class, 'getUnvisitList']);
    Route::post('/delete-unvisit',     [VisitController_dev::class, 'deleteUnvisit']);

    // ─── Join Visit ──────────────────────────────────────────────────────────
    Route::get('/get-app-config',         [JoinVisitController_dev::class, 'getAppConfig']);
    Route::post('/call-join-visit',       [JoinVisitController_dev::class, 'callJoinVisit']);
    Route::post('/approval-join-visit',   [JoinVisitController_dev::class, 'approvalJoinVisit']);
    Route::post('/approval-join-details', [JoinVisitController_dev::class, 'joinVisitDetails']);
    Route::post('/copy-join-visit',       [JoinVisitController_dev::class, 'copyJoinVisit']);

    // ─── Offline ─────────────────────────────────────────────────────────────
    Route::post('/offline-call-plan', [VisitController_dev::class, 'offlineCallPlan']);

    // ─── S3 Object Storage ───────────────────────────────────────────────────
    Route::post('/s3/presigned-url',   [S3PresignedController_dev::class, 'getPresignedUrl']);
    Route::post('/s3/confirm-upload',  [S3PresignedController_dev::class, 'confirmUpload']);
    Route::delete('/s3/delete-object', [S3PresignedController_dev::class, 'deleteObject']);

});
