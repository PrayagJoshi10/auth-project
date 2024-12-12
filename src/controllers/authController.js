const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sendEmail } = require("../utils/emailService");
const { body, validationResult } = require("express-validator");

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

exports.signup = async (req, res) => {
  const { name, email, password } = req.body;

  // Input validation
  await body("name").notEmpty().trim().escape().run(req);
  await body("email").isEmail().normalizeEmail().run(req);
  await body("password").isLength({ min: 8 }).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const existingUser = await User.findOne({ email });
    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOTP();
    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(400).json({ message: "User already exists" });
      } else {
        existingUser.password = hashedPassword;
        existingUser.otp = otp;
        existingUser.otpExpiration = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await existingUser.save();
      }
    } else {
      const user = new User({
        name,
        email,
        password: hashedPassword,
        isVerified: false,
        otp,
        otpExpiration: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      });

      await user.save();
    }

    sendEmail(email, "OTP Verification", `Your OTP is: ${otp}`);

    res.status(201).json({
      message:
        "User created successfully. OTP sent to your email for verification.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  // Input validation
  await body("email").isEmail().normalizeEmail().run(req);
  await body("otp").isNumeric().isLength({ min: 6, max: 6 }).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.otp !== otp || Date.now() > user.otpExpiration) {
      return res.status(400).json({ message: "Invalid OTP or expired" });
    }

    if (!user.isVerified) {
      user.isVerified = true;
    }
    user.otp = null;
    user.otpExpiration = null;
    await user.save();
    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(200).json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  // Input validation
  await body("email").isEmail().normalizeEmail().run(req);
  await body("password").notEmpty().run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(200).json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  // Input validation
  await body("email").isEmail().normalizeEmail().run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate a new OTP
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpiration = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    // Send OTP to user's email
    sendEmail(
      email,
      "Password Reset OTP",
      `Your OTP to reset password is: ${otp}`
    );

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  // Input validation
  await body("email").isEmail().normalizeEmail().run(req);
  await body("otp").isNumeric().isLength({ min: 6, max: 6 }).run(req);
  await body("newPassword").isLength({ min: 8 }).run(req);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.otp !== otp || Date.now() > user.otpExpiration) {
      return res.status(400).json({ message: "Invalid OTP or expired" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.otp = null;
    user.otpExpiration = null;
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
