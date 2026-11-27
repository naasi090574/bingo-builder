import { createClient } from 'npm:@supabase/supabase-js@2.89.0';
import { bucket } from './publication.mjs';

export function publicationServices() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const client = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const storage = client.storage.from(bucket);
  const table = () => client.from('game_publications');
  function unwrap<T>({ data, error }: { data: T; error: unknown }): T {
    if (error) throw error;
    return data;
  }

  function required<T>(result: { data: T | null; error: unknown }): T {
    const data = unwrap(result);
    if (data === null) throw new Error('Missing storage response');
    return data;
  }

  return {
    ownerId: Deno.env.get('BINGO_OWNER_UID'),
    async authenticate(authorization: string | null) {
      const token = authorization?.match(/^Bearer (\S+)$/i)?.[1];
      if (!token) return null;
      const { data, error } = await client.auth.getUser(token);
      return error ? null : data.user;
    },
    async findOwned(owner: string, id: string) {
      return unwrap(await table().select('*').eq('owner_id', owner).eq('local_id', id).maybeSingle());
    },
    async findPublished(id: string) {
      return unwrap(await table().select('id,revision,manifest,published').eq('id', id).eq('published', true).maybeSingle());
    },
    async create(owner: string, id: string) {
      unwrap(await table().upsert({ owner_id: owner, local_id: id }, {
        onConflict: 'owner_id,local_id', ignoreDuplicates: true,
      }));
      return unwrap(await table().select('*').eq('owner_id', owner).eq('local_id', id).single());
    },
    async compareAndSet(row: {id: string; owner_id: string; generation: number}, changes: object) {
      return unwrap(await table().update({ ...changes, generation: row.generation + 1, updated_at: new Date().toISOString() })
        .eq('id', row.id).eq('owner_id', row.owner_id).eq('generation', row.generation).select('*').maybeSingle());
    },
    async signUploads(paths: string[]) {
      const urls = [];
      for (let offset = 0; offset < paths.length; offset += 12) {
        urls.push(...await Promise.all(paths.slice(offset, offset + 12).map(async path =>
          required(await storage.createSignedUploadUrl(path, { upsert: false })).signedUrl)));
      }
      return urls;
    },
    async signDownloads(paths: string[]) {
      if (!paths.length) return [];
      const signed = required(await storage.createSignedUrls(paths, 300));
      const urls = new Map(signed.map(file => [file.path, file.signedUrl]));
      return paths.map(path => {
        const url = urls.get(path);
        if (!url) throw new Error('Missing download URL');
        return url;
      });
    },
    async checkFiles(prefix: string, files: {size: number; type: string}[]) {
      if (!files.length) return true;
      const list = required(await storage.list(prefix, { limit: 501 }));
      const found = new Map(list.map(file => [file.name, file]));
      return list.length === files.length && files.every((entry, index) => {
        const item = found.get(String(index));
        return item?.metadata?.size === entry.size && item.metadata.mimetype === entry.type;
      });
    },
  };
}
