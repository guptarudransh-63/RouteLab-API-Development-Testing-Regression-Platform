import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User.js';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

function createAndSetToken(user, res) {
  const secret = process.env.JWT_SECRET || 'routelab_super_secret_jwt_key_development_change_in_production_32char';
  const token = jwt.sign({ id: user._id, role: user.role }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  res.cookie('routelab_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return token;
}

export async function register(req, res, next) {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await User.findOne({ email: data.email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered',
      });
    }

    const user = await User.create({
      name: data.name,
      email: data.email.toLowerCase(),
      password: data.password,
    });

    const token = createAndSetToken(user, res);

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        preferences: user.preferences,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const data = loginSchema.parse(req.body);

    const user = await User.findOne({ email: data.email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    const isMatch = await user.comparePassword(data.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    const token = createAndSetToken(user, res);

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        preferences: user.preferences,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res) {
  res.clearCookie('routelab_token');
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
}

export async function getMe(req, res) {
  res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      preferences: req.user.preferences,
    },
  });
}

export async function updatePreferences(req, res, next) {
  try {
    const { theme, allowLocalRequests } = req.body;
    const user = req.user;

    if (theme) user.preferences.theme = theme;
    if (allowLocalRequests !== undefined) user.preferences.allowLocalRequests = allowLocalRequests;

    await user.save();

    res.status(200).json({
      success: true,
      preferences: user.preferences,
    });
  } catch (err) {
    next(err);
  }
}
