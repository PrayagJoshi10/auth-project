exports.getUserProfile = async (req, res) => {
  try {
    const user = req.user; // User object is attached by the auth middleware

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};
