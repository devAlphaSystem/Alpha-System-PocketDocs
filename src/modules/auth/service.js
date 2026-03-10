import { pbAuthWithPassword } from "../../lib/pocketbase.js";
import { COLLECTIONS, ROLES } from "../../config/constants.js";
import { AuthenticationError } from "../../errors/taxonomy.js";
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
