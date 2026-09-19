import 'server-only';
import { randomUUID } from 'node:crypto';
import type { DigitalHumanProfile, DigitalHumanProviderId } from './types';

interface Queryable {
  query<TRow extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: TRow[]; rowCount?: number | null }>;
}

interface ProfileRow extends Record<string, unknown> {
  id: string;
  provider_id: DigitalHumanProviderId;
  name: string;
  status: DigitalHumanProfile['status'];
  thumbnail_asset_id: string | null;
  error_code: string | null;
  error_message: string | null;
  consent_version: string;
  consent_at: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
  remote_profile_id: string | null;
  remote_job_id: string | null;
  credential_fingerprint: string;
}
export interface DigitalHumanJobRow extends Record<string, unknown> {
  id: string;
  profile_id: string;
  status: string;
  progress: number;
}
export interface DigitalHumanClipRow extends Record<string, unknown> {
  id: string;
  action_id: string;
  status: string;
  progress: number;
  cache_key: string;
  remote_job_id: string | null;
  output_asset_id: string | null;
  error_code: string | null;
  error_message: string | null;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS digital_human_profiles (
    id text PRIMARY KEY, owner_id text NOT NULL, provider_id text NOT NULL,
    remote_profile_id text, remote_job_id text, name text NOT NULL, status text NOT NULL,
    thumbnail_asset_id text, credential_fingerprint text NOT NULL,
    consent_version text NOT NULL, consent_at timestamptz NOT NULL, consent_hash text NOT NULL,
    error_code text, error_message text, created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
  )`,
  `CREATE INDEX IF NOT EXISTS digital_human_profiles_owner_idx ON digital_human_profiles(owner_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS digital_human_export_jobs (
    id text PRIMARY KEY, owner_id text NOT NULL, profile_id text NOT NULL,
    status text NOT NULL, progress integer NOT NULL DEFAULT 0, output_config jsonb NOT NULL,
    error_code text, error_message text, created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS digital_human_jobs_owner_idx ON digital_human_export_jobs(owner_id, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS digital_human_clips (
    id text PRIMARY KEY, job_id text NOT NULL REFERENCES digital_human_export_jobs(id) ON DELETE CASCADE,
    owner_id text NOT NULL, action_id text NOT NULL, audio_sha256 text NOT NULL,
    cache_key text NOT NULL, remote_job_id text, output_asset_id text, status text NOT NULL,
    progress integer NOT NULL DEFAULT 0, error_code text, error_message text,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(job_id, action_id)
  )`,
  `CREATE TABLE IF NOT EXISTS digital_human_clip_cache (
    owner_id text NOT NULL, cache_key text NOT NULL, output_asset_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner_id, cache_key)
  )`,
];

export async function ensureDigitalHumanSchema(db: Queryable): Promise<void> {
  for (const statement of SCHEMA) await db.query(statement);
}

function publicProfile(row: ProfileRow): DigitalHumanProfile {
  return {
    id: row.id,
    providerId: row.provider_id,
    name: row.name,
    status: row.status,
    ...(row.thumbnail_asset_id ? { thumbnailAssetId: row.thumbnail_asset_id } : {}),
    ...(row.error_code ? { errorCode: row.error_code } : {}),
    ...(row.error_message ? { errorMessage: row.error_message } : {}),
    consentVersion: row.consent_version,
    consentAt: new Date(row.consent_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export class DigitalHumanStore {
  constructor(private readonly db: Queryable) {}

  async createProfile(input: {
    ownerId: string;
    providerId: DigitalHumanProviderId;
    name: string;
    remoteJobId: string;
    credentialFingerprint: string;
    consentVersion: string;
    consentHash: string;
  }): Promise<DigitalHumanProfile> {
    const id = randomUUID();
    const result = await this.db.query<ProfileRow>(
      `INSERT INTO digital_human_profiles
       (id,owner_id,provider_id,remote_job_id,name,status,credential_fingerprint,consent_version,consent_at,consent_hash)
       VALUES($1,$2,$3,$4,$5,'creating',$6,$7,now(),$8) RETURNING *`,
      [
        id,
        input.ownerId,
        input.providerId,
        input.remoteJobId,
        input.name,
        input.credentialFingerprint,
        input.consentVersion,
        input.consentHash,
      ],
    );
    return publicProfile(result.rows[0]);
  }

  async listProfiles(ownerId: string): Promise<DigitalHumanProfile[]> {
    const result = await this.db.query<ProfileRow>(
      `SELECT * FROM digital_human_profiles WHERE owner_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [ownerId],
    );
    return result.rows.map(publicProfile);
  }

  async getProfile(
    ownerId: string,
    id: string,
  ): Promise<
    | (DigitalHumanProfile & {
        remoteProfileId?: string;
        remoteJobId?: string;
        credentialFingerprint: string;
      })
    | null
  > {
    const result = await this.db.query<ProfileRow>(
      `SELECT * FROM digital_human_profiles WHERE owner_id=$1 AND id=$2 AND deleted_at IS NULL`,
      [ownerId, id],
    );
    const row = result.rows[0];
    return row
      ? {
          ...publicProfile(row),
          remoteProfileId: row.remote_profile_id || undefined,
          remoteJobId: row.remote_job_id || undefined,
          credentialFingerprint: row.credential_fingerprint,
        }
      : null;
  }

  async updateProfile(
    ownerId: string,
    id: string,
    patch: { status: string; remoteProfileId?: string; errorCode?: string; errorMessage?: string },
  ): Promise<void> {
    await this.db.query(
      `UPDATE digital_human_profiles SET status=$3, remote_profile_id=COALESCE($4,remote_profile_id), error_code=$5,
       error_message=$6, updated_at=now() WHERE owner_id=$1 AND id=$2`,
      [
        ownerId,
        id,
        patch.status,
        patch.remoteProfileId || null,
        patch.errorCode || null,
        patch.errorMessage || null,
      ],
    );
  }

  async renameProfile(ownerId: string, id: string, name: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE digital_human_profiles SET name=$3,updated_at=now() WHERE owner_id=$1 AND id=$2 AND deleted_at IS NULL`,
      [ownerId, id, name],
    );
    return (result.rowCount || 0) > 0;
  }

  async markDeleted(ownerId: string, id: string): Promise<void> {
    await this.db.query(
      `UPDATE digital_human_profiles SET status='deleting',updated_at=now() WHERE owner_id=$1 AND id=$2`,
      [ownerId, id],
    );
  }

  async finishDelete(ownerId: string, id: string): Promise<void> {
    await this.db.query(
      `UPDATE digital_human_profiles SET deleted_at=now(),updated_at=now() WHERE owner_id=$1 AND id=$2`,
      [ownerId, id],
    );
  }

  async failDelete(ownerId: string, id: string, message: string): Promise<void> {
    await this.updateProfile(ownerId, id, {
      status: 'delete_failed',
      errorCode: 'provider_failure',
      errorMessage: message,
    });
  }

  async profileAssetIds(ownerId: string, profileId: string): Promise<string[]> {
    const result = await this.db.query<{ output_asset_id: string }>(
      `SELECT DISTINCT c.output_asset_id FROM digital_human_clips c
       JOIN digital_human_export_jobs j ON j.id=c.job_id
       WHERE j.owner_id=$1 AND j.profile_id=$2 AND c.output_asset_id IS NOT NULL`,
      [ownerId, profileId],
    );
    return result.rows.map((row) => row.output_asset_id);
  }

  async purgeProfileData(ownerId: string, profileId: string): Promise<void> {
    await this.db.query(
      `DELETE FROM digital_human_clip_cache cc WHERE cc.owner_id=$1 AND cc.output_asset_id IN (
       SELECT c.output_asset_id FROM digital_human_clips c JOIN digital_human_export_jobs j ON j.id=c.job_id
       WHERE j.owner_id=$1 AND j.profile_id=$2 AND c.output_asset_id IS NOT NULL)`,
      [ownerId, profileId],
    );
    await this.db.query(
      `DELETE FROM digital_human_export_jobs WHERE owner_id=$1 AND profile_id=$2`,
      [ownerId, profileId],
    );
  }

  async createExportJob(input: {
    ownerId: string;
    profileId: string;
    outputConfig: Record<string, unknown>;
  }): Promise<string> {
    const id = randomUUID();
    await this.db.query(
      `INSERT INTO digital_human_export_jobs(id,owner_id,profile_id,status,output_config) VALUES($1,$2,$3,'queued',$4)`,
      [id, input.ownerId, input.profileId, JSON.stringify(input.outputConfig)],
    );
    return id;
  }

  async addClip(input: {
    id?: string;
    jobId: string;
    ownerId: string;
    actionId: string;
    audioSha256: string;
    cacheKey: string;
    remoteJobId?: string;
    outputAssetId?: string;
    status: string;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO digital_human_clips(id,job_id,owner_id,action_id,audio_sha256,cache_key,remote_job_id,output_asset_id,status,progress)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(job_id,action_id) DO NOTHING`,
      [
        input.id || randomUUID(),
        input.jobId,
        input.ownerId,
        input.actionId,
        input.audioSha256,
        input.cacheKey,
        input.remoteJobId || null,
        input.outputAssetId || null,
        input.status,
        input.status === 'succeeded' ? 100 : 0,
      ],
    );
  }

  async cachedAsset(ownerId: string, cacheKey: string): Promise<string | null> {
    const result = await this.db.query<{ output_asset_id: string }>(
      `SELECT output_asset_id FROM digital_human_clip_cache WHERE owner_id=$1 AND cache_key=$2`,
      [ownerId, cacheKey],
    );
    return result.rows[0]?.output_asset_id || null;
  }

  async recoverableClip(
    ownerId: string,
    cacheKey: string,
  ): Promise<{ remoteJobId?: string; outputAssetId?: string; status: string } | null> {
    const result = await this.db.query<DigitalHumanClipRow>(
      `SELECT remote_job_id,output_asset_id,status FROM digital_human_clips
       WHERE owner_id=$1 AND cache_key=$2 AND status IN ('queued','running','succeeded')
       ORDER BY updated_at DESC LIMIT 1`,
      [ownerId, cacheKey],
    );
    const row = result.rows[0];
    return row
      ? {
          remoteJobId: row.remote_job_id || undefined,
          outputAssetId: row.output_asset_id || undefined,
          status: row.status,
        }
      : null;
  }

  async getJob(ownerId: string, id: string): Promise<DigitalHumanJobRow | null> {
    const result = await this.db.query<DigitalHumanJobRow>(
      `SELECT * FROM digital_human_export_jobs WHERE owner_id=$1 AND id=$2`,
      [ownerId, id],
    );
    return result.rows[0] || null;
  }

  async listClips(ownerId: string, jobId: string): Promise<DigitalHumanClipRow[]> {
    const result = await this.db.query<DigitalHumanClipRow>(
      `SELECT * FROM digital_human_clips WHERE owner_id=$1 AND job_id=$2 ORDER BY created_at,id`,
      [ownerId, jobId],
    );
    return result.rows;
  }

  async updateClip(
    ownerId: string,
    id: string,
    patch: {
      status: string;
      progress: number;
      outputAssetId?: string;
      errorCode?: string;
      errorMessage?: string;
    },
  ): Promise<void> {
    await this.db.query(
      `UPDATE digital_human_clips SET status=$3,progress=$4,output_asset_id=COALESCE($5,output_asset_id),error_code=$6,error_message=$7,updated_at=now() WHERE owner_id=$1 AND id=$2`,
      [
        ownerId,
        id,
        patch.status,
        patch.progress,
        patch.outputAssetId || null,
        patch.errorCode || null,
        patch.errorMessage || null,
      ],
    );
  }

  async cacheClip(ownerId: string, cacheKey: string, assetId: string): Promise<void> {
    await this.db.query(
      `INSERT INTO digital_human_clip_cache(owner_id,cache_key,output_asset_id) VALUES($1,$2,$3) ON CONFLICT(owner_id,cache_key) DO UPDATE SET output_asset_id=EXCLUDED.output_asset_id,created_at=now()`,
      [ownerId, cacheKey, assetId],
    );
  }

  async updateJobProgress(ownerId: string, id: string): Promise<void> {
    await this.db.query(
      `UPDATE digital_human_export_jobs j SET progress=s.progress,
       status=CASE WHEN s.failed>0 THEN 'failed' WHEN s.done=s.total THEN 'succeeded' WHEN s.running>0 THEN 'running' ELSE 'queued' END,
       updated_at=now() FROM (SELECT job_id,COUNT(*) total,COUNT(*) FILTER(WHERE status='succeeded') done,
       COUNT(*) FILTER(WHERE status='failed') failed,COUNT(*) FILTER(WHERE status IN ('running','queued')) running,
       COALESCE(ROUND(AVG(progress)),0)::int progress FROM digital_human_clips WHERE owner_id=$1 AND job_id=$2 GROUP BY job_id) s
       WHERE j.owner_id=$1 AND j.id=$2 AND j.id=s.job_id`,
      [ownerId, id],
    );
  }
}
