<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\DB;

class ImageController extends Controller
{
    public function uploadPhoto(Request $req)
    {
        $req->validate([
            'photo' => 'required|image|mimes:jpeg,png,jpg|max:5120',
        ]);

        $file = $req->file('photo');

        $isSignature = str_contains($file->getClientOriginalName(), 'signature') || 
                    $req->has('type') && $req->type === 'signature';
        
                 //ganti file path disini
        $uploadDir = $isSignature 
            ? public_path('assets/images/ttd')
            : public_path('assets/images/photos');    
        
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        if ($isSignature) {
            $filename = 'signature_' . time() . '_' . Str::random(5) . '.' . $file->getClientOriginalExtension();
        } else {
            $filename = time() . '_' . Str::random(5) . '.' . $file->getClientOriginalExtension();
        }
        $file->move($uploadDir, $filename);
        
        return response()->json([
            'success' => true,
            'filename' => $filename,
            'path' => url($isSignature ? 'assets/images/ttd/' . $filename : 'assets/images/photos/' . $filename), 
        ]);
    }


    public function savePhoto(Request $req)
    {
        $req->validate([
            'id' => 'required|integer|exists:call_plan_actual,id',
            'foto' => 'required|string|max:100',
        ]);

        DB::table('call_plan_actual')
            ->where('id', $req->id)
            ->update(['foto' => $req->foto]);

        return response()->json(['success' => true]);
    }

    public function saveSignature(Request $req)
    {
        $req->validate([
            'id' => 'required|integer|exists:call_plan_actual,id',
            'signature' => 'required|string|max:100', 
        ]);

        DB::table('call_plan_actual')
            ->where('id', $req->id)
            ->update(['tanda_tangan' => $req->signature]); 

        return response()->json(['success' => true]);
    }
}
