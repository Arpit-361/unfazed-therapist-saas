const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

const router = express.Router();

const email = body('email').trim().isEmail().withMessage('Enter a valid email address').normalizeEmail({ gmail_remove_dots: false });
const strongPassword = body('password')
  .isLength({ min: 8, max: 128 })
  .withMessage('Password must be at least 8 characters')
  .matches(/[A-Za-z]/)
  .withMessage('Password must include a letter')
  .matches(/\d/)
  .withMessage('Password must include a number');
const loginPassword = body('password').isString().notEmpty().withMessage('Password is required');
const name = body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2-80 characters');
const timezone = body('timezone').optional().isString().isLength({ max: 64 });

router.post(
  '/register',
  validate([name, email, strongPassword, body('slug').optional({ values: 'falsy' }).trim().toLowerCase()]),
  auth.register
);
router.post('/login', validate([email, loginPassword]), auth.login);

router.post(
  '/client/login',
  validate([email, loginPassword, body('slug').optional({ values: 'falsy' }).trim().toLowerCase()]),
  auth.clientLogin
);
router.post(
  '/client/register',
  validate([
    body('slug').trim().toLowerCase().notEmpty().withMessage('Therapist link is required'),
    name,
    email,
    strongPassword,
    body('phone').optional().trim().isLength({ max: 20 }),
    timezone,
  ]),
  auth.clientRegister
);

router.get('/invite/:token', validate([param('token').isHexadecimal().isLength({ min: 64, max: 64 })]), auth.getInvite);
router.post(
  '/invite/:token/accept',
  validate([param('token').isHexadecimal().isLength({ min: 64, max: 64 }), strongPassword, timezone]),
  auth.acceptInvite
);

router.get('/me', protect, auth.me);

module.exports = router;
