import { pbAuthWithPassword, pbCreate } from "../../lib/pocketbase.js";
import { COLLECTIONS, ROLES } from "../../config/constants.js";
import { AuthenticationError, ValidationError, ConflictError } from "../../errors/taxonomy.js";
import { logger } from "../../lib/logger.js";

/**
 * Authenticates a user with email and password and returns session data.
 *
 * @param {string} email - The user's email address.
 * @param {string} password - The user's password.
 * @param {string} requestId - The unique request identifier for logging.
 * @returns {Promise<{ token: string, user: Object }>} The auth token and user profile.
 * @throws {AuthenticationError} If the credentials are invalid.
 */
export async function loginUser(email, password, requestId) {
  const result = await pbAuthWithPassword(COLLECTIONS.USERS, email, password);

  if (!result.ok) {
    logger.warn("Login failed", { requestId, email: email.split("@")[0] + "@***" });
    throw new AuthenticationError("Invalid email or password.");
  }

  logger.info("User logged in", { requestId, userId: result.data.record.id });
  return {
    token: result.data.token,
    user: {
      id: result.data.record.id,
      email: result.data.record.email,
      name: result.data.record.name,
      role: result.data.record.role || ROLES.EDITOR,
    },
  };
}

/**
 * Registers a new user account and automatically signs them in.
 *
 * @param {Object} data - Registration data.
 * @param {string} data.email - The new user's email address.
 * @param {string} data.password - The new user's password.
 * @param {string} data.passwordConfirm - Password confirmation.
 * @param {string} data.name - The new user's display name.
 * @param {string} requestId - The unique request identifier for logging.
 * @returns {Promise<{ token: string, user: Object }>} The auth token and user profile.
 * @throws {ConflictError} If the email is already registered.
 * @throws {ValidationError} If the registration data is invalid.
 */
export async function registerUser(data, requestId) {
  const createResult = await pbCreate(COLLECTIONS.USERS, {
    email: data.email,
    password: data.password,
    passwordConfirm: data.passwordConfirm,
    name: data.name,
    role: ROLES.EDITOR,
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

  logger.info("User registered", { requestId, userId: createResult.data.id });

  const loginResult = await pbAuthWithPassword(COLLECTIONS.USERS, data.email, data.password);
  if (!loginResult.ok) {
    throw new AuthenticationError("Account created but login failed. Please try logging in.");
  }

  return {
    token: loginResult.data.token,
    user: {
      id: loginResult.data.record.id,
      email: loginResult.data.record.email,
      name: loginResult.data.record.name,
      role: loginResult.data.record.role || ROLES.EDITOR,
    },
  };
}
