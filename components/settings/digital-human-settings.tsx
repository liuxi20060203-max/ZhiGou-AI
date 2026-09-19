'use client';
import { useEffect, useState } from 'react';
import { Loader2, Pencil, RefreshCw, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  DIGITAL_HUMAN_CAPABILITIES,
  type DigitalHumanProfile,
  type DigitalHumanProviderId,
} from '@/lib/digital-human/types';
import {
  appendDigitalHumanCredentials,
  digitalHumanCredentialHeaders,
  useDigitalHumanSettings,
} from '@/lib/digital-human/client-settings';

interface Capability {
  providerId: DigitalHumanProviderId;
  enabled: boolean;
  serverConfigured: boolean;
}

export function DigitalHumanSettings() {
  const providerId = useDigitalHumanSettings((state) => state.providerId);
  const credentials = useDigitalHumanSettings((state) => state.credentials[providerId]);
  const setProviderId = useDigitalHumanSettings((state) => state.setProviderId);
  const setCredentials = useDigitalHumanSettings((state) => state.setCredentials);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [profiles, setProfiles] = useState<DigitalHumanProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState('我的数字人');
  const [video, setVideo] = useState<File>();
  const [videoSeconds, setVideoSeconds] = useState<number>();
  const [authorization, setAuthorization] = useState<File>();
  const capability = capabilities.find((item) => item.providerId === providerId);
  const spec = DIGITAL_HUMAN_CAPABILITIES[providerId];

  const reload = async () => {
    const response = await fetch('/api/digital-human/profiles');
    const data = (await response.json()) as { profiles?: DigitalHumanProfile[] };
    setProfiles(data.profiles ?? []);
  };
  useEffect(() => {
    Promise.all([
      fetch('/api/digital-human/capability').then((r) => r.json()),
      fetch('/api/digital-human/profiles').then((r) => r.json()),
    ])
      .then(([capabilityData, profileData]) => {
        setCapabilities((capabilityData as { providers?: Capability[] }).providers ?? []);
        setProfiles((profileData as { profiles?: DigitalHumanProfile[] }).profiles ?? []);
      })
      .catch(() => {});
  }, []);

  const verify = async () => {
    setBusy(true);
    const form = new FormData();
    form.append('providerId', providerId);
    appendDigitalHumanCredentials(form, providerId);
    const response = await fetch('/api/digital-human/verify', { method: 'POST', body: form });
    setBusy(false);
    toast[response.ok ? 'success' : 'error'](
      response.ok ? '连接成功' : '连接失败，请检查凭证与网关',
    );
  };
  const upload = async () => {
    if (!video || !consent || !name.trim()) return;
    if (!videoSeconds || videoSeconds < spec.minVideoSeconds || videoSeconds > spec.maxVideoSeconds)
      return toast.error(`视频时长需为 ${spec.minVideoSeconds}–${spec.maxVideoSeconds} 秒`);
    if (video.size > spec.maxVideoBytes) return toast.error('视频文件超过大小限制');
    setBusy(true);
    const form = new FormData();
    form.append('providerId', providerId);
    form.append('name', name);
    form.append('video', video);
    form.append('consent', 'true');
    form.append('consentVersion', 'digital-human-consent-v1');
    if (authorization) form.append('authorization', authorization);
    appendDigitalHumanCredentials(form, providerId);
    const response = await fetch('/api/digital-human/profiles', { method: 'POST', body: form });
    const data = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) return toast.error(data.error || '提交建模失败');
    setVideo(undefined);
    setAuthorization(undefined);
    setConsent(false);
    await reload();
    toast.success('已提交建模任务');
  };
  const refresh = async (profile: DigitalHumanProfile) => {
    setBusy(true);
    const response = await fetch(`/api/digital-human/profiles/${profile.id}`, {
      headers: digitalHumanCredentialHeaders(profile.providerId),
    });
    setBusy(false);
    if (!response.ok) toast.error('状态查询失败');
    await reload();
  };
  const remove = async (profile: DigitalHumanProfile) => {
    if (!confirm(`删除数字人“${profile.name}”？远端形象和缓存也会进入清理流程。`)) return;
    setBusy(true);
    const response = await fetch(`/api/digital-human/profiles/${profile.id}`, {
      method: 'DELETE',
      headers: digitalHumanCredentialHeaders(profile.providerId),
    });
    setBusy(false);
    if (!response.ok) toast.error('供应商删除失败，可稍后重试');
    await reload();
  };
  const rename = async (profile: DigitalHumanProfile) => {
    const next = prompt('数字人名称', profile.name)?.trim();
    if (!next || next === profile.name) return;
    const response = await fetch(`/api/digital-human/profiles/${profile.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: next }),
    });
    if (!response.ok) toast.error('重命名失败');
    await reload();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <section className="space-y-3">
        <h3 className="font-medium">数字人服务</h3>
        <select
          className="w-full rounded-md border bg-background p-2"
          value={providerId}
          onChange={(e) => setProviderId(e.target.value as DigitalHumanProviderId)}
        >
          <option value="tencent-digital-human">腾讯云智能数智人</option>
          <option value="volcengine-digital-human">火山引擎数字人</option>
        </select>
        {!capability?.serverConfigured && (
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="rounded-md border bg-background p-2 text-sm"
              placeholder={providerId.startsWith('tencent') ? 'SecretId' : 'AccessKey'}
              value={credentials.accessId}
              onChange={(e) => setCredentials(providerId, { accessId: e.target.value })}
            />
            <input
              className="rounded-md border bg-background p-2 text-sm"
              type="password"
              placeholder="SecretKey"
              value={credentials.secretKey}
              onChange={(e) => setCredentials(providerId, { secretKey: e.target.value })}
            />
            <input
              className="sm:col-span-2 rounded-md border bg-background p-2 text-sm"
              placeholder="企业数字人网关 HTTPS 地址"
              value={credentials.baseUrl}
              onChange={(e) => setCredentials(providerId, { baseUrl: e.target.value })}
            />
          </div>
        )}
        {capability?.serverConfigured && (
          <p className="text-xs text-muted-foreground">
            由服务器统一配置，客户端凭证不会覆盖服务器配置。
          </p>
        )}
        <Button variant="outline" onClick={verify} disabled={busy || capability?.enabled === false}>
          测试连接
        </Button>
      </section>
      <section className="space-y-3 border-t pt-5">
        <h3 className="font-medium">创建本人数字人</h3>
        <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
          {spec.materialGuidance.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          视频 {spec.minVideoSeconds}–{spec.maxVideoSeconds} 秒，最大{' '}
          {Math.round(spec.maxVideoBytes / 1024 / 1024)} MB。
        </p>
        <input
          className="w-full rounded-md border bg-background p-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label className="block text-sm">
          正脸短视频
          <input
            className="mt-1 block w-full text-xs"
            type="file"
            accept={spec.acceptedVideoMimeTypes.join(',')}
            onChange={(e) => {
              const file = e.target.files?.[0];
              setVideo(file);
              setVideoSeconds(undefined);
              if (!file) return;
              const url = URL.createObjectURL(file);
              const probe = document.createElement('video');
              probe.preload = 'metadata';
              probe.onloadedmetadata = () => {
                setVideoSeconds(probe.duration);
                URL.revokeObjectURL(url);
              };
              probe.onerror = () => URL.revokeObjectURL(url);
              probe.src = url;
            }}
          />
          {videoSeconds !== undefined && (
            <span className="mt-1 block text-xs text-muted-foreground">
              {videoSeconds.toFixed(1)} 秒
            </span>
          )}
        </label>
        <label className="block text-sm">
          授权材料（按供应商要求）
          <input
            className="mt-1 block w-full text-xs"
            type="file"
            onChange={(e) => setAuthorization(e.target.files?.[0])}
          />
        </label>
        <label className="flex gap-2 text-xs">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>我确认素材为本人，或已取得合法、单独且充分的形象与声音处理授权。</span>
        </label>
        <Button onClick={upload} disabled={busy || !video || !consent || !capability?.enabled}>
          <Upload className="mr-2 h-4 w-4" />
          提交建模
        </Button>
      </section>
      <section className="space-y-3 border-t pt-5">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">我的数字人</h3>
          <Button variant="ghost" size="sm" onClick={() => reload()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        {profiles.map((profile) => (
          <div key={profile.id} className="flex items-center gap-3 rounded-md border p-3">
            <div className="flex-1">
              <div className="text-sm font-medium">{profile.name}</div>
              <div className="text-xs text-muted-foreground">
                {profile.status}
                {profile.errorMessage ? ` · ${profile.errorMessage}` : ''}
              </div>
            </div>
            {profile.status === 'creating' && (
              <Button variant="ghost" size="sm" onClick={() => refresh(profile)} disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => rename(profile)} disabled={busy}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => remove(profile)} disabled={busy}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {!profiles.length && <p className="text-sm text-muted-foreground">暂无形象。</p>}
      </section>
    </div>
  );
}
