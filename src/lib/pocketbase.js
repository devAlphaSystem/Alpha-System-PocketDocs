import PocketBase from "pocketbase";
import { env } from "../config/env.js";
import { logger } from "./logger.js";
import { ExternalServiceError, InfrastructureError } from "../errors/taxonomy.js";

export function pbFilterValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const pb = new PocketBase(env.POCKETBASE_URL);
pb.autoCancellation(false);

function wrapPbError(err, operation) {
  if (err.status) {
    return new ExternalServiceError(`PocketBase error during ${operation}: ${err.status}`, {
      cause: err,
    });
  }
  if (err.message?.includes("ETIMEDOUT") || err.message?.includes("timeout")) {
    return new InfrastructureError(`PocketBase timeout during ${operation}: ${err.message}`, {
      cause: err,
    });
  }
  if (err.message?.includes("ECONNREFUSED") || err.message?.includes("ECONNRESET")) {
    return new InfrastructureError(`PocketBase connection failed during ${operation}: ${err.message}`, {
      cause: err,
    });
  }
  return new InfrastructureError(`Unexpected error during ${operation}: ${err.message}`, {
    cause: err,
  });
}

async function ensureAdminAuth() {
  if (!pb.authStore.isValid) {
    await authenticateAdmin();
  }
}

export async function authenticateAdmin() {
  try {
    const result = await pb.collection("_superusers").authWithPassword(env.POCKETBASE_ADMIN_EMAIL, env.POCKETBASE_ADMIN_PASSWORD);
    logger.info("PocketBase admin authentication successful");
    return result.token;
  } catch (err) {
    throw new ExternalServiceError(`PocketBase admin auth failed: ${err.message}`, { cause: err });
  }
}

export async function pbAuthWithPassword(collection, identity, password) {
  const client = new PocketBase(env.POCKETBASE_URL);
  client.autoCancellation(false);
  try {
    const result = await client.collection(collection).authWithPassword(identity, password);
    return { ok: true, status: 200, data: { token: result.token, record: result.record } };
  } catch (err) {
    if (err.status) {
      return { ok: false, status: err.status, data: err.data };
    }
    throw wrapPbError(err, `authWithPassword:${collection}`);
  }
}

export async function pbList(collection, params = {}) {
  await ensureAdminAuth();
  const start = Date.now();
  try {
    const result = await pb.collection(collection).getList(params.page || 1, params.perPage || 30, {
      sort: params.sort,
      filter: params.filter,
      expand: params.expand,
      fields: params.fields,
    });
    logger.debug("PocketBase query completed", { operation: "list", collection, duration_ms: Date.now() - start });
    return result;
  } catch (err) {
    logger.debug("PocketBase query failed", { operation: "list", collection, duration_ms: Date.now() - start });
    throw wrapPbError(err, `list:${collection}`);
  }
}

export async function pbGetOne(collection, id, params = {}) {
  await ensureAdminAuth();
  const start = Date.now();
  try {
    const result = await pb.collection(collection).getOne(id, {
      expand: params.expand,
      fields: params.fields,
    });
    logger.debug("PocketBase query completed", { operation: "getOne", collection, duration_ms: Date.now() - start });
    return result;
  } catch (err) {
    if (err.status === 404) return null;
    logger.debug("PocketBase query failed", { operation: "getOne", collection, duration_ms: Date.now() - start });
    throw wrapPbError(err, `getOne:${collection}:${id}`);
  }
}

export async function pbGetFirstByFilter(collection, filter, params = {}) {
  await ensureAdminAuth();
  const start = Date.now();
  try {
    const result = await pb.collection(collection).getFirstListItem(filter, {
      expand: params.expand,
      fields: params.fields,
    });
    logger.debug("PocketBase query completed", { operation: "getFirstByFilter", collection, duration_ms: Date.now() - start });
    return result;
  } catch (err) {
    if (err.status === 404) return null;
    logger.debug("PocketBase query failed", { operation: "getFirstByFilter", collection, duration_ms: Date.now() - start });
    throw wrapPbError(err, `getFirstByFilter:${collection}`);
  }
}

export async function pbCreate(collection, data) {
  await ensureAdminAuth();
  const start = Date.now();
  try {
    const record = await pb.collection(collection).create(data);
    logger.debug("PocketBase write completed", { operation: "create", collection, duration_ms: Date.now() - start });
    return { ok: true, status: 200, data: record };
  } catch (err) {
    logger.debug("PocketBase write failed", { operation: "create", collection, duration_ms: Date.now() - start });
    if (err.status) {
      return { ok: false, status: err.status, data: err.data };
    }
    throw wrapPbError(err, `create:${collection}`);
  }
}

export async function pbUpdate(collection, id, data) {
  await ensureAdminAuth();
  const start = Date.now();
  try {
    const record = await pb.collection(collection).update(id, data);
    logger.debug("PocketBase write completed", { operation: "update", collection, duration_ms: Date.now() - start });
    return { ok: true, status: 200, data: record };
  } catch (err) {
    logger.debug("PocketBase write failed", { operation: "update", collection, duration_ms: Date.now() - start });
    if (err.status) {
      return { ok: false, status: err.status, data: err.data };
    }
    throw wrapPbError(err, `update:${collection}:${id}`);
  }
}

export async function pbDelete(collection, id) {
  await ensureAdminAuth();
  const start = Date.now();
  try {
    await pb.collection(collection).delete(id);
    logger.debug("PocketBase write completed", { operation: "delete", collection, duration_ms: Date.now() - start });
    return { ok: true, status: 204 };
  } catch (err) {
    logger.debug("PocketBase write failed", { operation: "delete", collection, duration_ms: Date.now() - start });
    if (err.status) {
      return { ok: false, status: err.status };
    }
    throw wrapPbError(err, `delete:${collection}:${id}`);
  }
}

export async function pbAuthRefresh(token) {
  const client = new PocketBase(env.POCKETBASE_URL);
  client.autoCancellation(false);
  client.authStore.save(token);
  try {
    const result = await client.collection("users").authRefresh();
    return { token: result.token, record: result.record };
  } catch (_err) {
    return null;
  }
}
