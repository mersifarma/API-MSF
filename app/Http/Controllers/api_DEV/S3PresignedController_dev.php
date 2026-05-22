<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Aws\S3\S3Client;

class S3PresignedController_dev extends Controller
{
    // ─── Helper: buat instance S3Client dari config .env 
    private function makeS3Client(): S3Client
    {
        return new S3Client([
            'version'                 => 'latest',
            'region'                  => env('AWS_DEFAULT_REGION', 'us-east-1'),
            'endpoint'                => env('AWS_S3_ENDPOINT'),
            'use_path_style_endpoint' => (bool) env('AWS_USE_PATH_STYLE_ENDPOINT', true),
            'credentials'             => [
                'key'    => env('AWS_ACCESS_KEY_ID'),
                'secret' => env('AWS_SECRET_ACCESS_KEY'),
            ],
        ]);
    }

    // Request  : JSON { nama_file, extensi, size, type }
    // Response : JSON { presigned_url, s3_key, public_url, mime_type }
    public function getPresignedUrl(Request $req)
    {
        $req->validate([
            'nama_file' => 'required|string|max:255',
            'extensi'   => 'required|in:jpg,jpeg,png',
            'size'      => 'required|integer|min:1|max:10485760', // max 10 MB = 10*1024*1024
            'type'      => 'required|in:photo,signature',
        ]);

        // Tentukan folder & prefix berdasarkan tipe file
        $folder   = $req->type === 'signature' ? 'ttd'   : 'photos';
        $prefix   = $req->type === 'signature' ? 'ttd_'  : 'foto_';
        $ext      = strtolower($req->extensi);
        $s3Key    = $folder . '/' . $prefix . time() . '_' . Str::random(8) . '.' . $ext;
        $mimeType = 'image/' . ($ext === 'jpg' ? 'jpeg' : $ext);

        $s3 = $this->makeS3Client();

        // ACL public-read: file langsung bisa diakses publik via URL tanpa auth
        $command = $s3->getCommand('PutObject', [
            'Bucket'       => env('AWS_BUCKET'),
            'Key'          => $s3Key,
            'ContentType'  => $mimeType,
            'ACL'          => 'public-read',
        ]);

        // Generate URL yang ditandatangani, berlaku 15 menit
        $presignedRequest = $s3->createPresignedRequest($command, '+120 minutes');
        $presignedUrl     = (string) $presignedRequest->getUri();

        // URL publik permanen untuk tampil gambar setelah upload
        // Format: https://BUCKET.is3.cloudhost.id/KEY
        $publicUrl = 'https://' . config('filesystems.disks.s3.bucket') . '.is3.cloudhost.id/' . $s3Key;

        return response()->json([
            'success'       => true,
            'presigned_url' => $presignedUrl,  
            's3_key'        => $s3Key,        
            'public_url'    => $publicUrl,      // URL final untuk Image.network di Flutter
            'mime_type'     => $mimeType,       // Dipakai sebagai Content-Type saat PUT
        ]);
    }

    
    // Request  : JSON { id, s3_key, type }
    // Response : JSON { success, public_url }
    public function confirmUpload(Request $req)
    {
        $req->validate([
            'id'     => 'required|integer|exists:call_plan_actual,id',
            's3_key' => 'required|string|max:500',
            'type'   => 'required|in:photo,signature',
        ]);

        $publicUrl = 'https://' . config('filesystems.disks.s3.bucket') . '.is3.cloudhost.id/' . $req->s3_key;

        $column = $req->type === 'photo' ? 'foto_link' : 'ttd_link';

        DB::table('call_plan_actual')
            ->where('id', $req->id)
            ->update([$column => $publicUrl]);

        return response()->json([
            'success'    => true,
            'public_url' => $publicUrl,
        ]);
    }

    // CLEANUP — Flutter hapus file S3 yang tidak jadi dipakai
    public function deleteObject(Request $req)
    {
        $req->validate([
            's3_key' => 'required|string|max:500',
        ]);

        try {
            $s3 = $this->makeS3Client();
            $s3->deleteObject([
                'Bucket' => env('AWS_BUCKET'),
                'Key'    => $req->s3_key,
            ]);
            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            // tidak error fatal — cleanup opsional, tidak menghalangi alur utama
            return response()->json(['success' => false, 'message' => $e->getMessage()], 200);
        }
    }
}