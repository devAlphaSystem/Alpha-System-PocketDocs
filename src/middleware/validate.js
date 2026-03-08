import { ValidationError } from "../errors/taxonomy.js";

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

export function validateQuery(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        code: issue.code.toUpperCase(),
        message: issue.message,
      }));
      return next(new ValidationError("Invalid query parameters.", details));
    }
    req.validatedQuery = result.data;
    next();
  };
}

export function validateParams(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        code: issue.code.toUpperCase(),
        message: issue.message,
      }));
      return next(new ValidationError("Invalid route parameters.", details));
    }
    req.validatedParams = result.data;
    next();
  };
}
