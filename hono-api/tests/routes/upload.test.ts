import { beforeAll, describe, expect, it } from 'bun:test';
import { request } from '../helpers/app';
import { loginAs } from '../helpers/auth';

type SuccessBody<T> = { success: true; data: T };
type PaginatedBody<T> = {
  success: true;
  data: T[];
  meta: { total: number; page: number; limit: number };
};
type ErrorBody = { success: false; error: { message: string; code: string; details?: unknown } };

const VERSION_HEADERS = { 'X-App-Version': '1.0.0' } as const;

async function deleteAllAssets() {
  const { db } = await import('../../src/config/database');
  const { media_assets } = await import('../../src/db/schema/media-assets');
  await db.delete(media_assets);
}

beforeAll(async () => {
  await deleteAllAssets();
});

// =============================================================================
// POST /api/upload/presign
// =============================================================================
describe('POST /api/upload/presign', () => {
  it('201 happy path — return assetId + presignedUrl + s3Key', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<
      SuccessBody<{
        assetId: string;
        presignedUrl: string;
        s3Key: string;
        url: string;
        expiresAt: string;
      }>
    >('POST', '/api/upload/presign', {
      token,
      headers: VERSION_HEADERS,
      body: {
        asset_type: 'image',
        file_name: 'visit-photo.jpg',
        mime_type: 'image/jpeg',
        size_bytes: 102400,
      },
    });
    expect(status).toBe(201);
    expect(body.data.assetId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.data.presignedUrl).toContain('test-bucket');
    expect(body.data.s3Key).toMatch(/^uploads\/image\/1\/\d+-[A-Za-z0-9_-]+\.jpg$/);
    expect(body.data.url).toContain('test-bucket');
  });

  it('422 untuk MIME yang tidak diizinkan di asset_type', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('POST', '/api/upload/presign', {
      token,
      headers: VERSION_HEADERS,
      body: {
        asset_type: 'image',
        file_name: 'doc.pdf',
        mime_type: 'application/pdf',
      },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 untuk asset_type yang tidak ada di enum', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('POST', '/api/upload/presign', {
      token,
      headers: VERSION_HEADERS,
      body: {
        asset_type: 'video',
        file_name: 'vid.mp4',
        mime_type: 'video/mp4',
      },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 untuk body tanpa file_name', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('POST', '/api/upload/presign', {
      token,
      headers: VERSION_HEADERS,
      body: { asset_type: 'image', mime_type: 'image/jpeg' },
    });
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('426 tanpa X-App-Version', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('POST', '/api/upload/presign', {
      token,
      body: {
        asset_type: 'image',
        file_name: 'photo.jpg',
        mime_type: 'image/jpeg',
      },
    });
    expect(status).toBe(426);
    expect(body.error.code).toBe('VERSION_OUTDATED');
  });

  it('401 tanpa token', async () => {
    const { status } = await request('POST', '/api/upload/presign', {
      headers: VERSION_HEADERS,
      body: { asset_type: 'image', file_name: 'x.jpg', mime_type: 'image/jpeg' },
    });
    expect(status).toBe(401);
  });
});

// =============================================================================
// POST /api/upload/:id/confirm
// =============================================================================
describe('POST /api/upload/:id/confirm', () => {
  async function makePending(): Promise<string> {
    const { token } = await loginAs('mr01');
    const { body } = await request<SuccessBody<{ assetId: string }>>(
      'POST',
      '/api/upload/presign',
      {
        token,
        headers: VERSION_HEADERS,
        body: {
          asset_type: 'image',
          file_name: 'confirm.jpg',
          mime_type: 'image/jpeg',
        },
      },
    );
    return body.data.assetId;
  }

  it('200 pending → active', async () => {
    const assetId = await makePending();
    const { token } = await loginAs('mr01');
    const { status, body } = await request<SuccessBody<{ id: string; status: string }>>(
      'POST',
      `/api/upload/${assetId}/confirm`,
      { token, headers: VERSION_HEADERS },
    );
    expect(status).toBe(200);
    expect(body.data.id).toBe(assetId);
    expect(body.data.status).toBe('active');
  });

  it('409 ALREADY_CONFIRMED kalau di-confirm dua kali', async () => {
    const assetId = await makePending();
    const { token } = await loginAs('mr01');
    await request('POST', `/api/upload/${assetId}/confirm`, {
      token,
      headers: VERSION_HEADERS,
    });
    const { status, body } = await request<ErrorBody>(
      'POST',
      `/api/upload/${assetId}/confirm`,
      { token, headers: VERSION_HEADERS },
    );
    expect(status).toBe(409);
    expect(body.error.code).toBe('ALREADY_CONFIRMED');
  });

  it('403 kalau confirm milik pegawai lain', async () => {
    const assetId = await makePending(); // dibuat oleh mr01
    const { token } = await loginAs('dm01'); // beda owner
    const { status, body } = await request<ErrorBody>(
      'POST',
      `/api/upload/${assetId}/confirm`,
      { token, headers: VERSION_HEADERS },
    );
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('404 untuk id yang tidak ada', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>(
      'POST',
      '/api/upload/00000000-0000-0000-0000-000000000000/confirm',
      { token, headers: VERSION_HEADERS },
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('422 untuk id bukan UUID', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>(
      'POST',
      '/api/upload/not-a-uuid/confirm',
      { token, headers: VERSION_HEADERS },
    );
    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});

// =============================================================================
// GET /api/upload/:id
// =============================================================================
describe('GET /api/upload/:id', () => {
  it('returns asset metadata', async () => {
    const { token } = await loginAs('mr01');
    const { body: presignBody } = await request<SuccessBody<{ assetId: string }>>(
      'POST',
      '/api/upload/presign',
      {
        token,
        headers: VERSION_HEADERS,
        body: {
          asset_type: 'document',
          file_name: 'report.pdf',
          mime_type: 'application/pdf',
        },
      },
    );
    const { status, body } = await request<
      SuccessBody<{ id: string; asset_type: string; mime_type: string }>
    >('GET', `/api/upload/${presignBody.data.assetId}`, { token });
    expect(status).toBe(200);
    expect(body.data.id).toBe(presignBody.data.assetId);
    expect(body.data.asset_type).toBe('document');
    expect(body.data.mime_type).toBe('application/pdf');
  });

  it('404 untuk id yang tidak ada', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>(
      'GET',
      '/api/upload/00000000-0000-0000-0000-000000000000',
      { token },
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

// =============================================================================
// GET /api/upload (list paginated)
// =============================================================================
describe('GET /api/upload', () => {
  beforeAll(async () => {
    await deleteAllAssets();
    const { token } = await loginAs('mr01');
    // Seed 3 image untuk mr01
    for (let i = 0; i < 3; i++) {
      await request('POST', '/api/upload/presign', {
        token,
        headers: VERSION_HEADERS,
        body: {
          asset_type: 'image',
          file_name: `list-${i}.jpg`,
          mime_type: 'image/jpeg',
        },
      });
    }
  });

  it('returns paginated assets dengan meta', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<PaginatedBody<{ id: string }>>(
      'GET',
      '/api/upload?page=1&limit=10',
      { token },
    );
    expect(status).toBe(200);
    expect(body.meta.total).toBe(3);
    expect(body.data.length).toBe(3);
  });

  it('mine=true filter ke owner', async () => {
    const { token } = await loginAs('dm01'); // tidak punya asset
    const { status, body } = await request<PaginatedBody<unknown>>(
      'GET',
      '/api/upload?mine=true',
      { token },
    );
    expect(status).toBe(200);
    expect(body.meta.total).toBe(0);
  });

  it('asset_type filter', async () => {
    const { token } = await loginAs('mr01');
    const { status, body } = await request<PaginatedBody<unknown>>(
      'GET',
      '/api/upload?asset_type=document',
      { token },
    );
    expect(status).toBe(200);
    expect(body.meta.total).toBe(0);
  });
});

// =============================================================================
// DELETE /api/upload/:id
// =============================================================================
describe('DELETE /api/upload/:id', () => {
  async function makeAsset(): Promise<string> {
    const { token } = await loginAs('mr01');
    const { body } = await request<SuccessBody<{ assetId: string }>>(
      'POST',
      '/api/upload/presign',
      {
        token,
        headers: VERSION_HEADERS,
        body: {
          asset_type: 'image',
          file_name: 'del.jpg',
          mime_type: 'image/jpeg',
        },
      },
    );
    return body.data.assetId;
  }

  it('soft-delete by owner — subsequent GET returns 404', async () => {
    const assetId = await makeAsset();
    const { token } = await loginAs('mr01');
    const del = await request<SuccessBody<{ deleted: true }>>(
      'DELETE',
      `/api/upload/${assetId}`,
      { token, headers: VERSION_HEADERS },
    );
    expect(del.status).toBe(200);
    expect(del.body.data.deleted).toBe(true);

    const get = await request<ErrorBody>('GET', `/api/upload/${assetId}`, { token });
    expect(get.status).toBe(404);
  });

  it('403 kalau delete milik pegawai lain', async () => {
    const assetId = await makeAsset();
    const { token } = await loginAs('dm01');
    const { status, body } = await request<ErrorBody>('DELETE', `/api/upload/${assetId}`, {
      token,
      headers: VERSION_HEADERS,
    });
    expect(status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('426 tanpa X-App-Version', async () => {
    const assetId = await makeAsset();
    const { token } = await loginAs('mr01');
    const { status, body } = await request<ErrorBody>('DELETE', `/api/upload/${assetId}`, {
      token,
    });
    expect(status).toBe(426);
    expect(body.error.code).toBe('VERSION_OUTDATED');
  });
});
