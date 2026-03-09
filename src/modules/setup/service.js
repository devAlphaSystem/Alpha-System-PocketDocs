import { pbList, pbCreate, pbAuthWithPassword } from "../../lib/pocketbase.js";
import { COLLECTIONS, ROLES } from "../../config/constants.js";
import { AuthenticationError, ValidationError, ConflictError } from "../../errors/taxonomy.js";
import { logger } from "../../lib/logger.js";

let ownerExists = null;

/**
 * Checks whether at least one user (owner) exists in the database.
 *
 * @returns {Promise<boolean>} `true` if an owner account exists.
 */
export async function checkOwnerExists() {
  const result = await pbList(COLLECTIONS.USERS, { perPage: 1 });
  ownerExists = result.totalItems > 0;
  return ownerExists;
}

/**
 * Returns whether the owner setup step has been completed.
 *
 * @returns {boolean} `true` if an owner account has been confirmed.
 */
export function isOwnerSetupComplete() {
  return ownerExists === true;
}

/**
 * Marks the owner setup as complete in the in-memory flag.
 *
 * @returns {void}
 */
export function markOwnerSetupComplete() {
  ownerExists = true;
}

/**
 * Registers the initial owner account and automatically signs them in.
 *
 * @param {Object} data - Registration data.
 * @param {string} data.email - The owner's email address.
 * @param {string} data.password - The owner's password.
 * @param {string} data.passwordConfirm - Password confirmation.
 * @param {string} data.name - The owner's display name.
 * @param {string} requestId - The unique request identifier for logging.
 * @returns {Promise<{ token: string, user: Object }>} The auth token and user profile.
 * @throws {ConflictError} If setup has already been completed.
 * @throws {ValidationError} If the registration data is invalid.
 */
export async function registerOwner(data, requestId) {
  if (ownerExists) {
    throw new ConflictError("Setup has already been completed.");
  }

  const existing = await pbList(COLLECTIONS.USERS, { perPage: 1 });
  if (existing.totalItems > 0) {
    ownerExists = true;
    throw new ConflictError("Setup has already been completed.");
  }

  const createResult = await pbCreate(COLLECTIONS.USERS, {
    email: data.email,
    password: data.password,
    passwordConfirm: data.passwordConfirm,
    name: data.name,
    role: ROLES.OWNER,
    verified: true,
  });

  if (!createResult.ok) {
    const pbErrors = createResult.data?.data;
    if (pbErrors?.email?.code === "validation_not_unique") {
      throw new ConflictError("An account with this email already exists.");
    }
    const details = Object.entries(pbErrors || {}).map(([field, err]) => ({
      field,
      code: (err.code || "INVALID").toUpperCase(),
      message: err.message || "Invalid value.",
    }));
    throw new ValidationError("Registration failed.", details);
  }

  logger.info("Owner account created", { requestId, userId: createResult.data.id });

  const loginResult = await pbAuthWithPassword(COLLECTIONS.USERS, data.email, data.password);
  if (!loginResult.ok) {
    throw new AuthenticationError("Account created but login failed. Please try logging in.");
  }

  ownerExists = true;

  return {
    token: loginResult.data.token,
    user: {
      id: loginResult.data.record.id,
      email: loginResult.data.record.email,
      name: loginResult.data.record.name,
      role: loginResult.data.record.role,
    },
  };
}
