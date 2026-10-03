const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

// Runs express-validator chains and converts failures into a consistent 400 response.
const validate = (chains) => async (req, res, next) => {
  for (const chain of chains) {
    await chain.run(req);
  }
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const details = result.array().map((e) => ({ field: e.path, message: e.msg }));
  return next(ApiError.badRequest(details[0].message, details));
};

module.exports = validate;
