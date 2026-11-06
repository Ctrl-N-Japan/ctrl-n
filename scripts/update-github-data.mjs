#!/usr/bin/env node
// Save public organization data for static page rendering. Requires Node.js 22+.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const organization = 'Ctrl-N-Japan';
const outputDirectory = fileURLToPath(new URL('../assets/data/', import.meta.url));

async function request(endpoint) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'ctrl-n-static-data' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`https://api.github.com/${endpoint}`, {
    headers, signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`GitHub HTTP ${response.status} for ${endpoint}`);
  return response;
}

export async function collect(endpoint, fields) {
  const items = [];
  for (let page = 1; page <= 1000; page++) {
    const response = await request(`orgs/${organization}/${endpoint}${endpoint.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('Invalid GitHub response');
    items.push(...batch.map(item => Object.fromEntries(fields.map(key => [key, item[key] ?? null]))));
    if (batch.length < 100) {
      return items.sort((a, b) => (a.login || a.name).toLowerCase().localeCompare((b.login || b.name).toLowerCase()));
    }
  }
  throw new Error('Pagination limit reached');
}

export async function contributorStats(repository) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const response = await request(`repos/${organization}/${encodeURIComponent(repository)}/stats/contributors`);
    if (response.status === 204) return [];
    if (response.status === 200) {
      const result = await response.json();
      if (!Array.isArray(result)) throw new Error('Invalid contributor statistics');
      return result;
    }
    if (response.status !== 202) throw new Error(`Unexpected statistics status: ${response.status}`);
    // GitHub returns 202 while preparing statistics; retain the snapshot if not ready.
    await delay(5000);
  }
  throw new Error(`Statistics not ready for ${repository}; previous snapshot retained`);
}

export const REVIEW_POINTS = 100;

async function pages(endpoint) {
  const results = [];
  for (let page = 1; page <= 1000; page++) {
    const response = await request(endpoint + (endpoint.includes('?') ? '&' : '?') + 'per_page=100&page=' + page);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('Invalid paginated response');
    results.push(...batch);
    if (batch.length < 100) return results;
  }
  throw new Error('Review pagination limit reached');
}

export function countReviewedPullRequests(pulls) {
  const counts = {};
  for (const pull of pulls) {
    const reviewers = new Set();
    for (const review of pull.reviews) {
      const login = review.user?.login?.toLowerCase();
      if (!login || login === pull.author?.toLowerCase()) continue;
      if (!review.submitted_at || !['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED'].includes(review.state)) continue;
      reviewers.add(login);
    }
    for (const login of reviewers) counts[login] = (counts[login] || 0) + 1;
  }
  return counts;
}

export async function reviewStats(repository) {
  const base = 'repos/' + organization + '/' + encodeURIComponent(repository);
  const pulls = await pages(base + '/pulls?state=all');
  const result = [];
  for (const pull of pulls) {
    result.push({ author: pull.user?.login, reviews: await pages(base + '/pulls/' + pull.number + '/reviews') });
  }
  return countReviewedPullRequests(result);
}

export function rankMembers(members, statistics, reviewCounts = {}) {
  const totals = new Map(members.map(member => [member.login.toLowerCase(), {
    ...member, additions: 0, deletions: 0, commits: 0, reviews: reviewCounts[member.login.toLowerCase()] || 0,
  }]));
  for (const repository of statistics) {
    for (const contributor of repository) {
      const member = totals.get(contributor.author?.login?.toLowerCase());
      if (!member) continue;
      member.commits += contributor.total;
      for (const week of contributor.weeks) {
        member.additions += week.a;
        member.deletions += week.d;
      }
    }
  }
  return [...totals.values()]
    .map(member => ({ ...member, changed_lines: member.additions + member.deletions, score: member.additions + member.deletions + member.reviews * REVIEW_POINTS }))
    .sort((a, b) => b.score - a.score || b.changed_lines - a.changed_lines || a.login.toLowerCase().localeCompare(b.login.toLowerCase()));
}

export async function main() {
  // Complete all requests before writing either snapshot.
  const members = await collect('public_members', ['login']);
  const repos = await collect('repos?type=public&sort=updated', ['name', 'description', 'language', 'archived']);
  const statistics = [];
  for (const repo of repos) statistics.push(await contributorStats(repo.name));
  const reviewCounts = {};
  for (const repo of repos) {
    const counts = await reviewStats(repo.name);
    for (const [login, count] of Object.entries(counts)) reviewCounts[login] = (reviewCounts[login] || 0) + count;
  }
  const data = { 'members.json': rankMembers(members, statistics, reviewCounts), 'repos.json': repos };
  await mkdir(outputDirectory, { recursive: true });
  for (const [filename, items] of Object.entries(data)) {
    await writeFile(resolve(outputDirectory, filename), `${JSON.stringify(items, null, 2)}\n`);
    console.log(`${filename}: ${items.length} entries`);
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
