#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const root = new URL('../', import.meta.url);
const text = (value, length) => typeof value === 'string' ? value.trim().slice(0, length) : '';
function safeLink(value) {
  if (!value) return '';
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('作品URLはhttpsの公開URLにしてください');
  return url.href;
}
export function prepareProfiles(input, members, presets) {
  if (!Array.isArray(input.profiles)) throw new Error('profiles配列が必要です');
  const known = new Set(members.map(m => m.login.toLowerCase()));
  const profiles = {}, images = [], themes = {};
  for (const entry of input.profiles) {
    const login = text(entry.login, 40).toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/.test(login) || !known.has(login)) throw new Error(`公開メンバーに存在しません: ${login}`);
    if (Object.hasOwn(profiles, login)) throw new Error(`同じメンバーの回答が複数あります: ${login}`);
    const profile = { displayName: text(entry.displayName, 60), bio: text(entry.bio, 1000), skills: Array.isArray(entry.skills) ? entry.skills.slice(0, 12).map(s => text(s, 40)).filter(Boolean) : [], work: { title: text(entry.work?.title, 120), description: text(entry.work?.description, 2000), url: safeLink(text(entry.work?.url, 2000)) }, images: [] };
    if (!profile.displayName || !profile.bio) throw new Error(`表示名と自己紹介が必要です: ${login}`);
    for (const [index, image] of (Array.isArray(entry.images) ? entry.images.slice(0, 3) : []).entries()) {
      const extensions = {'image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
      const extension = extensions[image.type];
      if (!extension || typeof image.data !== 'string' || image.data.length > 7_000_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(image.data)) throw new Error('画像形式が不正です');
      const bytes = Buffer.from(image.data, 'base64');
      const valid = extension === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : extension === 'jpg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
      if (!valid || bytes.length > 5 * 1024 * 1024) throw new Error('画像の内容またはサイズが不正です');
      const path = `assets/images/members/${login}-${index + 1}.${extension}`;
      images.push({path,bytes}); profile.images.push(path);
    }
    const theme = text(entry.theme, 80);
    if (theme && !Object.hasOwn(presets, theme) && !['auto','auto-season','auto-time'].includes(theme)) throw new Error(`不明なテーマ: ${theme}`);
    if (theme) themes[login] = theme;
    profiles[login] = profile;
  }
  return {profiles,images,themes};
}
async function main() {
  if (!process.argv[2]) throw new Error('Usage: node scripts/import-member-profiles.mjs /path/to/ctrl-n-approved-profiles.json');
  const json = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
  const input = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const result = prepareProfiles(input, await json('assets/data/members.json'), await json('assets/data/theme-presets.json'));
  const settings = await json('assets/data/member-themes.json');
  for (const [login,theme] of Object.entries(result.themes)) {
    const key = Object.keys(settings).find(k=>k.toLowerCase()===login) || login;
    settings[key] = {...settings[key],theme};
  }
  for (const image of result.images) {
    const path = new URL(image.path, root);
    await mkdir(new URL('.',path),{recursive:true}); await writeFile(path,image.bytes);
  }
  await writeFile(new URL('assets/data/member-profiles.json',root),JSON.stringify(result.profiles,null,2)+'\n');
  await writeFile(new URL('assets/data/member-themes.json',root),JSON.stringify(settings,null,2)+'\n');
  console.log(`${Object.keys(result.profiles).length} profiles imported`);
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main().catch(error=>{console.error(error.message);process.exitCode=1});
