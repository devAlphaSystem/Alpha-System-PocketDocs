import { pbList, pbGetOne, pbCreate, pbUpdate, pbDelete } from "../../lib/pocketbase.js";
import { COLLECTIONS, ROLES } from "../../config/constants.js";
import { ConflictError, ValidationError, NotFoundError, AuthorizationError } from "../../errors/taxonomy.js";
import { logger } from "../../lib/logger.js";

/**
 * Retrieves a paginated list of all users sorted by creation date.
 *
 * @param {number} [page=1] - The 1-based page number.
 * @returns {Promise<Object>} Paginated result containing user items.
 */
export async function listUsers(page = 1) {
  return await pbList(COLLECTIONS.USERS, {
    page,
    perPage: 50,
    sort: "-created",
  });
}

/**
 * Retrieves a single user by their ID.
 *
 * @param {string} id - The user record ID.
 * @returns {Promise<Object>} The user record.
 * @throws {NotFoundError} If the user does not exist.
 */
export async function getUser(id) {
  const user = await pbGetOne(COLLECTIONS.USERS, id);
  if (!user) {
    throw new NotFoundError("User");
  }
  return user;
}

/**
 * Creates a new user account.
 *
 * @param {Object} data - User creation data.
 * @param {string} data.email - The new user's email address.
 * @param {string} data.password - The new user's password.
 * @param {string} data.passwordConfirm - Password confirmation.
 * @param {string} data.name - The new user's display name.
 * @param {string} data.role - The assigned role.
 * @param {string} requestId - The unique request identifier for logging.
 * @returns {Promise<Object>} The created user record.
 * @throws {ConflictError} If the email is already registered.
 * @throws {ValidationError} If the creation fails.
 */
export async function createUser(data, requestId) {
  const createResult = await pbCreate(COLLECTIONS.USERS, {
    email: data.email,
    password: data.password,
    passwordConfirm: data.passwordConfirm,
    name: data.name,
    role: data.role,
    verified: true,
  });

  if (!createResult.ok) {
    const pbErrors = createResult.data?.data;
    if (pbErrors?.email?.code === "validation_not_unique") {
      throw new ConflictError("A user with this email already exists.");
    }
    const details = Object.entries(pbErrors || {}).map(([field, err]) => ({
      field,
      code: (err.code || "INVALID").toUpperCase(),
      message: err.message || "Invalid value.",
    }));
    throw new ValidationError("Failed to create user.", details);
  }

  logger.info("User created by owner", { requestId, userId: createResult.data.id });
  return createResult.data;
}

/**
 * Updates an existing user account with optional password change.
 *
 * @param {string} id - The user record ID.
 * @param {Object} data - The fields to update.
 * @param {string} currentUserId - The ID of the user performing the update.
 * @param {string} requestId - The unique request identifier for logging.
 * @returns {Promise<Object>} The updated user record.
 * @throws {AuthorizationError} If attempting to modify another owner's account.
 * @throws {ConflictError} If the new email collides with an existing user.
 * @throws {ValidationError} If the update fails.
 */
export async function updateUser(id, data, currentUserId, requestId) {
  const existing = await pbGetOne(COLLECTIONS.USERS, id);
  if (!existing) {
    throw new NotFoundError("User");
  }

  if (existing.role === ROLES.OWNER && id !== currentUserId) {
    throw new AuthorizationError("Cannot modify another owner account.");
  }

  const updateData = {
    name: data.name,
    email: data.email,
    role: existing.role === ROLES.OWNER ? ROLES.OWNER : data.role,
  };

  if (data.password && data.password.length > 0) {
    updateData.password = data.password;
    updateData.passwordConfirm = data.passwordConfirm;
  }

  const updateResult = await pbUpdate(COLLECTIONS.USERS, id, updateData);

  if (!updateResult.ok) {
    const pbErrors = updateResult.data?.data;
    if (pbErrors?.email?.code === "validation_not_unique") {
      throw new ConflictError("A user with this email already exists.");
    }
    const details = Object.entries(pbErrors || {}).map(([field, err]) => ({
      field,
      code: (err.code || "INVALID").toUpperCase(),
      message: err.message || "Invalid value.",
    }));
    throw new ValidationError("Failed to update user.", details);
  }

  logger.info("User updated by owner", { requestId, userId: id });
  return updateResult.data;
}

/**
 * Deletes a user account, preventing self-deletion and owner deletion.
 *
 * @param {string} id - The user record ID to delete.
 * @param {string} currentUserId - The ID of the user performing the deletion.
 * @param {string} requestId - The unique request identifier for logging.
 * @returns {Promise<void>}
 * @throws {AuthorizationError} If the user attempts to delete themselves or an owner.
 * @throws {NotFoundError} If the user does not exist.
 */
export async function deleteUser(id, currentUserId, requestId) {
  if (id === currentUserId) {
    throw new AuthorizationError("You cannot delete your own account.");
  }

  const existing = await pbGetOne(COLLECTIONS.USERS, id);
  if (!existing) {
    throw new NotFoundError("User");
  }

  if (existing.role === ROLES.OWNER) {
    throw new AuthorizationError("Cannot delete an owner account.");
  }

  const result = await pbDelete(COLLECTIONS.USERS, id);
  if (!result.ok) {
    throw new ValidationError("Failed to delete user.");
  }

  logger.info("User deleted by owner", { requestId, userId: id });
}
