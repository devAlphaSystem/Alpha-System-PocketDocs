import { pbList, pbGetOne, pbCreate, pbUpdate, pbDelete } from "../../lib/pocketbase.js";
import { COLLECTIONS, ROLES } from "../../config/constants.js";
import { ConflictError, ValidationError, NotFoundError, AuthorizationError } from "../../errors/taxonomy.js";
import { logger } from "../../lib/logger.js";

export async function listUsers(page = 1) {
  return await pbList(COLLECTIONS.USERS, {
    page,
    perPage: 50,
    sort: "-created",
  });
}

export async function getUser(id) {
  const user = await pbGetOne(COLLECTIONS.USERS, id);
  if (!user) {
    throw new NotFoundError("User");
  }
  return user;
}

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
