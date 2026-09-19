# Digital-human provider gateway contract

Tencent Cloud and Volcengine digital-human endpoints and signing fields vary by contracted
product, tenant, and region. OpenMAIC therefore ships stable adapters for both provider ids and
connects them to an operator-managed HTTPS gateway. Vendor-specific signing, product ids, error
codes, and API revisions stay behind that gateway.

The server configuration is documented in `.env.example`. A browser BYOK endpoint is SSRF-checked;
an endpoint configured by the server operator is trusted and may be on a private network.

## HTTP contract

Every request carries `x-openmaic-provider`, `x-openmaic-access-id`, timestamp, nonce, and an HMAC
signature. The gateway must never log the secret or return it in an error.

- `GET /v1/credentials/verify`
- `POST /v1/profiles` — multipart `video` and optional `authorization`; returns `remoteJobId`.
- `GET /v1/profile-jobs/:id` — returns normalized job status and `remoteProfileId` on success.
- `DELETE /v1/profiles/:id`
- `POST /v1/speech-videos` — multipart `profileId`, `audio`, and JSON `output`; honors the
  `Idempotency-Key` header and returns `remoteJobId`.
- `GET /v1/jobs/:id` — returns normalized status and an origin-matching `downloadUrl` on success.

Normalized status is `{ status, progress, remoteProfileId?, downloadUrl?, errorCode?,
errorMessage? }`, where status is `queued`, `running`, `succeeded`, or `failed` and progress is
0–100. Output must be a muted H.264 MP4 at the requested fixed frame rate and `yuv420p`; the
classroom's original TTS remains the only audio track.

Tencent account concurrency is expected to be enforced by the gateway according to the contracted
quota. Volcengine submissions are serialized by OpenMAIC and should also be capped at one by the
gateway. Download URLs must use the same configured origin and responses are capped at 200 MB.
