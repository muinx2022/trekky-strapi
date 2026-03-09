import { randomUUID } from 'crypto';
import { google } from 'googleapis';
import type { Core } from '@strapi/strapi';

const PAGE_UID = 'api::page.page';
const SETTINGS_STORE = { type: 'core' as const, name: 'ga4-analytics', key: 'settings' };
const CACHE = new Map<string, { expiresAt: number; data: AdminAnalyticsOverview }>();
const ALLOWED_RANGES = ['7d', '30d', '90d'] as const;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export type AnalyticsRange = (typeof ALLOWED_RANGES)[number];

type SummaryMetrics = {
  users: number;
  sessions: number;
  views: number;
};

type SeriesPoint = {
  date: string;
  users: number;
  views: number;
};

type TopPage = {
  path: string;
  title: string;
  targetType: 'post' | 'page' | 'other';
  targetDocumentId: string | null;
  views: number;
  users: number;
};

export type AdminAnalyticsOverview = {
  range: AnalyticsRange;
  generatedAt: string;
  summary: SummaryMetrics;
  series: SeriesPoint[];
  topPages: TopPage[];
};

export type Ga4AnalyticsSettings = {
  propertyId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken: string;
  connectedAt: string | null;
  connectedEmail: string | null;
  oauthState: {
    nonce: string;
    returnTo: string;
    expiresAt: number;
  } | null;
};

export type Ga4AnalyticsSettingsPublic = {
  propertyId: string;
  clientId: string;
  clientSecret: string;
  connected: boolean;
  configured: boolean;
  connectedAt: string | null;
  connectedEmail: string | null;
};

type ReportRow = {
  dimensionValues?: Array<{ value?: string | null }>;
  metricValues?: Array<{ value?: string | null }>;
};

type PageLookup = {
  slug: string;
  documentId: string;
};

function getDefaultSettings(): Ga4AnalyticsSettings {
  return {
    propertyId: String(process.env.GA4_PROPERTY_ID ?? '').trim(),
    clientId: String(process.env.GOOGLE_OAUTH_CLIENT_ID ?? '').trim(),
    clientSecret: String(process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '').trim(),
    refreshToken: String(process.env.GA4_REFRESH_TOKEN ?? '').trim(),
    accessToken: '',
    connectedAt: null,
    connectedEmail: null,
    oauthState: null,
  };
}

function normalizeSettings(input: Partial<Ga4AnalyticsSettings> | null | undefined): Ga4AnalyticsSettings {
  const defaults = getDefaultSettings();
  return {
    propertyId: String(input?.propertyId ?? defaults.propertyId).trim(),
    clientId: String(input?.clientId ?? defaults.clientId).trim(),
    clientSecret: String(input?.clientSecret ?? defaults.clientSecret).trim(),
    refreshToken: String(input?.refreshToken ?? defaults.refreshToken).trim(),
    accessToken: String(input?.accessToken ?? defaults.accessToken).trim(),
    connectedAt: input?.connectedAt ? String(input.connectedAt) : defaults.connectedAt,
    connectedEmail: input?.connectedEmail ? String(input.connectedEmail) : defaults.connectedEmail,
    oauthState:
      input?.oauthState &&
      typeof input.oauthState.nonce === 'string' &&
      typeof input.oauthState.returnTo === 'string' &&
      Number.isFinite(input.oauthState.expiresAt)
        ? {
            nonce: input.oauthState.nonce,
            returnTo: input.oauthState.returnTo,
            expiresAt: Number(input.oauthState.expiresAt),
          }
        : null,
  };
}

function sanitizeSettings(settings: Ga4AnalyticsSettings): Ga4AnalyticsSettingsPublic {
  const configured = Boolean(settings.propertyId && settings.clientId && settings.clientSecret);
  return {
    propertyId: settings.propertyId,
    clientId: settings.clientId,
    clientSecret: settings.clientSecret,
    connected: Boolean(settings.refreshToken),
    configured,
    connectedAt: settings.connectedAt,
    connectedEmail: settings.connectedEmail,
  };
}

async function readSettings(strapi: Core.Strapi) {
  const store = strapi.store(SETTINGS_STORE);
  const current = (await store.get({})) as Partial<Ga4AnalyticsSettings> | null;
  return normalizeSettings(current);
}

async function writeSettings(strapi: Core.Strapi, settings: Ga4AnalyticsSettings) {
  const normalized = normalizeSettings(settings);
  const store = strapi.store(SETTINGS_STORE);
  await store.set({ value: normalized });
  CACHE.clear();
  return normalized;
}

function assertRange(range: string): AnalyticsRange {
  if ((ALLOWED_RANGES as readonly string[]).includes(range)) {
    return range as AnalyticsRange;
  }

  throw new Error('range must be one of 7d, 30d, or 90d');
}

function getDaysForRange(range: AnalyticsRange) {
  switch (range) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '90d':
      return 90;
    default:
      return 7;
  }
}

function parseMetric(value: string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseGaDate(raw: string | null | undefined) {
  if (!raw || raw.length !== 8) {
    return raw ?? '';
  }

  const year = raw.slice(0, 4);
  const month = raw.slice(4, 6);
  const day = raw.slice(6, 8);
  return `${year}-${month}-${day}`;
}

function decodePath(pathname: string) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

function extractPostDocumentId(pathname: string) {
  const match = pathname.match(/^\/p\/.+--([^/?#]+)$/);
  return match?.[1] ?? null;
}

function extractPageSlug(pathname: string) {
  const match = pathname.match(/^\/page\/([^/?#]+)$/);
  return match?.[1] ?? null;
}

function getCacheTtlMs() {
  const raw = Number(process.env.GA4_CACHE_TTL_SECONDS ?? '300');
  const seconds = Number.isFinite(raw) && raw > 0 ? raw : 300;
  return seconds * 1000;
}

function getRequestOrigin(url: string) {
  return new URL(url).origin;
}

function getRedirectUri(url: string) {
  return `${getRequestOrigin(url)}/api/management/google/ga4/callback`;
}

function assertConfigured(settings: Ga4AnalyticsSettings) {
  if (!settings.propertyId || !settings.clientId || !settings.clientSecret) {
    throw new Error('GA4 OAuth is not configured. Save property ID, client ID, and client secret first.');
  }
}

function assertConnected(settings: Ga4AnalyticsSettings) {
  assertConfigured(settings);
  if (!settings.refreshToken) {
    throw new Error('Google Analytics is not connected. Complete the OAuth connection first.');
  }
}

async function loadPageLookupMap(strapi: Core.Strapi, slugs: string[]) {
  const uniqueSlugs = Array.from(new Set(slugs.filter(Boolean)));
  if (uniqueSlugs.length === 0) {
    return new Map<string, string>();
  }

  const rows = (await strapi.db.query(PAGE_UID).findMany({
    where: { slug: { $in: uniqueSlugs } },
    select: ['slug', 'documentId'],
    limit: uniqueSlugs.length,
  })) as PageLookup[];

  return new Map(rows.map((item) => [item.slug, item.documentId]));
}

async function normalizeTopPages(strapi: Core.Strapi, rows: ReportRow[] | undefined) {
  const base = (rows ?? []).map((row) => {
    const rawPath = row.dimensionValues?.[0]?.value?.trim() || '';
    const path = decodePath(rawPath || '/');
    const title = row.dimensionValues?.[1]?.value?.trim() || path || '(not set)';
    const postDocumentId = extractPostDocumentId(path);
    const pageSlug = postDocumentId ? null : extractPageSlug(path);

    return {
      path: path || '/',
      title: title || '(not set)',
      targetType: postDocumentId ? ('post' as const) : pageSlug ? ('page' as const) : ('other' as const),
      targetDocumentId: postDocumentId,
      pageSlug,
      views: parseMetric(row.metricValues?.[0]?.value),
      users: parseMetric(row.metricValues?.[1]?.value),
    };
  });

  const pageLookup = await loadPageLookupMap(
    strapi,
    base.filter((item) => item.targetType === 'page' && item.pageSlug).map((item) => item.pageSlug as string),
  );

  return base.map(({ pageSlug, ...item }) => ({
    ...item,
    targetDocumentId:
      item.targetType === 'page' && pageSlug ? pageLookup.get(pageSlug) ?? null : item.targetDocumentId ?? null,
  }));
}

function buildOauthClient(settings: Ga4AnalyticsSettings, redirectUri: string) {
  return new google.auth.OAuth2({
    clientId: settings.clientId,
    clientSecret: settings.clientSecret,
    redirectUri,
  });
}

export async function getGa4AnalyticsSettings(strapi: Core.Strapi) {
  const settings = await readSettings(strapi);
  return sanitizeSettings(settings);
}

export async function updateGa4AnalyticsSettings(
  strapi: Core.Strapi,
  payload: Partial<Pick<Ga4AnalyticsSettings, 'propertyId' | 'clientId' | 'clientSecret'>>,
) {
  const current = await readSettings(strapi);
  const next = await writeSettings(strapi, {
    ...current,
    propertyId: String(payload.propertyId ?? current.propertyId).trim(),
    clientId: String(payload.clientId ?? current.clientId).trim(),
    clientSecret: String(payload.clientSecret ?? current.clientSecret).trim(),
  });
  return sanitizeSettings(next);
}

export async function disconnectGa4Analytics(strapi: Core.Strapi) {
  const current = await readSettings(strapi);
  const next = await writeSettings(strapi, {
    ...current,
    refreshToken: '',
    accessToken: '',
    connectedAt: null,
    connectedEmail: null,
    oauthState: null,
  });
  return sanitizeSettings(next);
}

export async function createGa4OauthUrl(strapi: Core.Strapi, requestUrl: string, returnTo: string) {
  const current = await readSettings(strapi);
  assertConfigured(current);

  const redirectUri = getRedirectUri(requestUrl);
  const oauthClient = buildOauthClient(current, redirectUri);
  const state = {
    nonce: randomUUID(),
    returnTo: String(returnTo || '').trim() || `${getRequestOrigin(requestUrl)}/dashboard`,
    expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
  };

  await writeSettings(strapi, {
    ...current,
    oauthState: state,
  });

  const url = oauthClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/analytics.readonly', 'openid', 'email'],
    state: state.nonce,
  });

  return { url };
}

export async function handleGa4OauthCallback(
  strapi: Core.Strapi,
  requestUrl: string,
  code: string,
  state: string,
) {
  const current = await readSettings(strapi);
  assertConfigured(current);

  if (!current.oauthState || current.oauthState.nonce !== state || current.oauthState.expiresAt < Date.now()) {
    throw new Error('OAuth state is invalid or expired. Start the Google connection flow again.');
  }

  const redirectUri = getRedirectUri(requestUrl);
  const oauthClient = buildOauthClient(current, redirectUri);
  const tokenResponse = await oauthClient.getToken(code);
  const tokens = tokenResponse.tokens;
  const refreshToken = String(tokens.refresh_token ?? current.refreshToken ?? '').trim();

  if (!refreshToken) {
    throw new Error('Google did not return a refresh token. Retry consent with prompt=consent.');
  }

  oauthClient.setCredentials({
    refresh_token: refreshToken,
    access_token: tokens.access_token ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  });

  let connectedEmail: string | null = current.connectedEmail;
  if (tokens.access_token) {
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauthClient });
      const userInfo = await oauth2.userinfo.get();
      connectedEmail = userInfo.data.email ?? connectedEmail;
    } catch {
      connectedEmail = current.connectedEmail;
    }
  }

  const next = await writeSettings(strapi, {
    ...current,
    refreshToken,
    accessToken: String(tokens.access_token ?? '').trim(),
    connectedAt: new Date().toISOString(),
    connectedEmail,
    oauthState: null,
  });

  return {
    settings: next,
    returnTo: current.oauthState.returnTo,
  };
}

async function fetchFromGa4(
  strapi: Core.Strapi,
  range: AnalyticsRange,
  settings: Ga4AnalyticsSettings,
): Promise<AdminAnalyticsOverview> {
  const redirectUri = `${process.env.PUBLIC_URL || 'http://localhost:1337'}/api/management/google/ga4/callback`;
  const oauthClient = buildOauthClient(settings, redirectUri);
  oauthClient.setCredentials({
    refresh_token: settings.refreshToken,
    access_token: settings.accessToken || undefined,
  });

  const analyticsData = google.analyticsdata({ version: 'v1beta', auth: oauthClient });
  const days = getDaysForRange(range);

  let response;
  try {
    response = await analyticsData.properties.batchRunReports({
      property: `properties/${settings.propertyId}`,
      requestBody: {
        requests: [
          {
            dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
            metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
          },
          {
            dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
            dimensions: [{ name: 'date' }],
            metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
            orderBys: [{ dimension: { dimensionName: 'date' } }],
            keepEmptyRows: true,
          },
          {
            dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
            dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
            metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
            orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
            limit: '10',
          },
        ],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Google Analytics Data API request failed.';
    throw new Error(`Failed to load GA4 analytics: ${message}`);
  }

  const reports = response.data.reports ?? [];
  const summaryRow = reports[0]?.rows?.[0];
  const summary: SummaryMetrics = {
    users: parseMetric(summaryRow?.metricValues?.[0]?.value),
    sessions: parseMetric(summaryRow?.metricValues?.[1]?.value),
    views: parseMetric(summaryRow?.metricValues?.[2]?.value),
  };

  const series: SeriesPoint[] = (reports[1]?.rows ?? [])
    .map((row) => ({
      date: parseGaDate(row.dimensionValues?.[0]?.value),
      users: parseMetric(row.metricValues?.[0]?.value),
      views: parseMetric(row.metricValues?.[1]?.value),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const topPages = await normalizeTopPages(strapi, reports[2]?.rows);

  return {
    range,
    generatedAt: new Date().toISOString(),
    summary,
    series,
    topPages,
  };
}

export async function getAnalyticsOverview(strapi: Core.Strapi, inputRange: string) {
  const range = assertRange(inputRange);
  const cacheKey = `overview:${range}`;
  const ttlMs = getCacheTtlMs();
  const now = Date.now();
  const cached = CACHE.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const settings = await readSettings(strapi);
  assertConnected(settings);

  const data = await fetchFromGa4(strapi, range, settings);
  CACHE.set(cacheKey, {
    data,
    expiresAt: now + ttlMs,
  });

  return data;
}
