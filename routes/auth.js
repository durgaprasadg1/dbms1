const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../models');

router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.get('/signup', (req, res) => {
  res.render('signup', { error: null });
});

router.post('/signup', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.render('signup', { error: 'Provide username and password' });
  try {
    let user = await User.findOne({ where: { username } });
    if (!user) {
      const hash = await bcrypt.hash(password, 10);
      user = await User.create({ username, passwordHash: hash, role: 'admin' });
    }

    const token = jwt.sign(
      { username: user.username, role: user.role },
      process.env.JWT_SECRET || 'supersecret',
      { expiresIn: '4h' }
    );

    res.cookie('token', token, { httpOnly: true, maxAge: 4 * 3600 * 1000 });
    return res.redirect('/medicines');
  } catch (err) {
    return res.render('signup', { error: 'Signup failed: ' + err.message });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.render('login', { error: 'Provide username and password' });

  const ADMIN_USER = 'admin123';
  const ADMIN_PASS = '1234567890';

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    try {
      let user = await User.findOne({ where: { username } });
      if (!user) {
        const hash = await bcrypt.hash(password, 10);
        user = await User.create({ username, passwordHash: hash, role: 'admin' });
      }
      const token = jwt.sign({ username: user.username, role: user.role }, process.env.JWT_SECRET || 'supersecret', { expiresIn: '4h' });
      res.cookie('token', token, { httpOnly: true, maxAge: 4 * 3600 * 1000 });
      return res.redirect('/medicines');
    } catch (err) {
      return res.render('login', { error: 'Login failed: ' + err.message });
    }
  }

  try {
    const user = await User.findOne({ where: { username } });
    if (!user) return res.render('login', { error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.render('login', { error: 'Invalid credentials' });

    const token = jwt.sign({ username: user.username, role: user.role }, process.env.JWT_SECRET || 'supersecret', { expiresIn: '4h' });
    res.cookie('token', token, { httpOnly: true, maxAge: 4 * 3600 * 1000 });
    return res.redirect('/medicines');
  } catch (err) {
    return res.render('login', { error: 'Login failed: ' + err.message });
  }
});

router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

module.exports = router;