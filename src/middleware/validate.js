import { ValidationError } from "../errors/taxonomy.js";

/**
 * Creates middleware that validates `req.body` against a Zod schema and
 * attaches the parsed result to `req.validatedBody`.
 *
 * @param {import("zod").ZodSchema} schema - The Zod schema to validate against.
 * @returns {import("express").RequestHandler} Express middleware function.
 */
export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        code: issue.code.toUpperCase(),
        message: issue.message,
      }));
      return next(new ValidationError("One or more fields are invalid.", details));
    }
    req.validatedBody = result.data;
    next();
  };
}
