import { env } from "../../config/env.js";
import { ExternalServiceError } from "../../errors/taxonomy.js";
import { logger } from "../../lib/logger.js";

const GITHUB_API = "https://api.github.com";

export function isGitHubConfigured() {
  return !!env.GITHUB_TOKEN;
}

async function githubFetch(path, options = {}) {
  const url = `${GITHUB_API}${path}`;
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "PocketDocs",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }

  const start = Date.now();
  const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  const duration_ms = Date.now() - start;

  if (!res.ok) {
    logger.debug("GitHub API call failed", { path, status: res.status, duration_ms });
    const body = await res.json().catch(() => ({}));
    const message = body.message || `GitHub API returned ${res.status}`;
    throw new ExternalServiceError(`GitHub API error: ${message}`, { statusCode: res.status });
  }

  logger.debug("GitHub API call completed", { path, status: res.status, duration_ms });
  return res.json();
}

async function githubFetchRaw(url) {
  const headers = {
    Accept: "application/vnd.github.raw+json",
    "User-Agent": "PocketDocs",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }

  const start = Date.now();
  const res = await fetch(url, { headers });
  const duration_ms = Date.now() - start;

  if (!res.ok) {
    logger.debug("GitHub raw fetch failed", { status: res.status, duration_ms });
    throw new ExternalServiceError(`GitHub raw fetch failed: ${res.status}`, { statusCode: res.status });
  }

  logger.debug("GitHub raw fetch completed", { status: res.status, duration_ms });
  return res.text();
}

export function parseRepoUrl(url) {
  const cleaned = url
    .trim()
    .replace(/\.git$/, "")
    .replace(/\/$/, "");
  const match = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

export async function listUserRepos(page = 1, perPage = 30) {
  return githubFetch(`/user/repos?sort=updated&per_page=${perPage}&page=${page}&type=all`);
}

export async function getRepoInfo(owner, repo) {
  return githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
}

export async function listTags(owner, repo, page = 1, perPage = 30) {
  return githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tags?per_page=${perPage}&page=${page}`);
}

export async function listCommits(owner, repo, page = 1, perPage = 30) {
  return githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=${perPage}&page=${page}`);
}

export async function getDocsTree(owner, repo, ref) {
  try {
    const contents = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/docs?ref=${encodeURIComponent(ref)}`);
    if (!Array.isArray(contents)) return [];
    return contents;
  } catch (err) {
    if (err.statusCode === 404) return [];
    throw err;
  }
}

async function getContentsRecursive(owner, repo, ref, path) {
  const items = await githubFetch(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`);
  if (!Array.isArray(items)) return [];

  const results = [];
  for (const item of items) {
    if (item.type === "file" && item.name.endsWith(".md")) {
      results.push({ path: item.path, name: item.name, download_url: item.download_url });
    } else if (item.type === "dir") {
      const children = await getContentsRecursive(owner, repo, ref, item.path);
      results.push({ path: item.path, name: item.name, type: "dir", children });
    }
  }
  return results;
}

export async function getDocsTreeRecursive(owner, repo, ref) {
  try {
    return await getContentsRecursive(owner, repo, ref, "docs");
  } catch (err) {
    if (err.statusCode === 404) return [];
    throw err;
  }
}

export async function getFileContent(downloadUrl) {
  return githubFetchRaw(downloadUrl);
}

export function filenameToTitle(filename) {
  const name = filename.replace(/\.md$/i, "");
  if (name.toLowerCase() === "readme") return "Introduction";
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function filenameToSlug(filename) {
  return filename
    .replace(/\.md$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseFrontmatterTitle(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;
  const titleMatch = match[1].match(/^title:\s*['"]?(.+?)['"]?\s*$/m);
  return titleMatch ? titleMatch[1].trim() : null;
}

export function extractPageInfo(filename, content) {
  const fmTitle = parseFrontmatterTitle(content);
  return {
    title: fmTitle || filenameToTitle(filename),
    slug: filenameToSlug(filename),
    content,
  };
}

export async function importDocsForRef(owner, repo, ref) {
  const tree = await getDocsTreeRecursive(owner, repo, ref);
  const pages = [];

  async function processItems(items, parentSlug) {
    let order = 0;
    for (const item of items) {
      if (item.type === "dir") {
        const dirSlug = filenameToSlug(item.name);
        const dirTitle = filenameToTitle(item.name);
        pages.push({
          title: dirTitle,
          slug: dirSlug,
          content: "",
          parent: parentSlug,
          order: order++,
        });
        if (item.children) {
          await processItems(item.children, dirSlug);
        }
      } else {
        const rawContent = await getFileContent(item.download_url);
        const info = extractPageInfo(item.name, rawContent);
        const isReadme = item.name.toLowerCase() === "readme.md";
        pages.push({
          ...info,
          parent: parentSlug,
          order: isReadme ? -1 : order++,
        });
      }
    }
  }

  await processItems(tree, "");

  pages.sort((a, b) => a.order - b.order);
  pages.forEach((p, i) => {
    p.order = i;
  });

  logger.info("Docs imported for ref", { owner, repo, ref, pageCount: pages.length });
  return pages;
}
