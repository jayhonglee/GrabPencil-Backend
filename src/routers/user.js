const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const User = require("../models/user");
const auth = require("../middleware/auth");
const { sendWelcomeEmail, sendCancelationEmail } = require("../emails/account");
const router = new express.Router();

// Testing
router.post("/users/test", auth, async (req, res) => {
    try {
        res.status(201).send();
    } catch (e) {
        res.status(400).send(e);
        console.log(e);
    }
});

// Create user (Sign up)
router.post("/users", async (req, res) => {
    const user = new User(req.body);

    try {
        await user.save();
        // sendWelcomeEmail(user.email, user.firstName);
        const token = await user.generateAuthToken();

        res.cookie("auth_token", token, {
            domain: process.env.DOMAIN,
            // httpOnly: true,
            // secure: true,
        });
        res.status(201).send({ user, token });
    } catch (e) {
        res.status(400).send(e.message);
    }
});

// Login user (Login)
router.post("/users/login", async (req, res) => {
    try {
        const user = await User.findByCredentials(
            req.body.email,
            req.body.password
        );
        const token = await user.generateAuthToken();

        res.cookie("auth_token", token, {
            domain: process.env.DOMAIN,
            // httpOnly: true,
            // secure: true,
        });
        res.send({ user, token });
    } catch (e) {
        res.status(400).send(e.message);
        console.log(e.message);
    }
});

// Logout user (Logout)
router.post("/users/logout", auth, async (req, res) => {
    try {
        req.user.tokens = req.user.tokens.filter((token) => {
            return token.token !== req.token;
        });
        await req.user.save();

        res.send();
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// Logout all (Logout all devices)
router.post("/users/logoutAll", auth, async (req, res) => {
    try {
        req.user.tokens = [];
        await req.user.save();
        res.send();
    } catch (e) {
        res.status(500).send(e.message);
    }
});

const upload = multer({
    limits: {
        fileSize: 1000000,
    },
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error("Please upload an image"));
        }

        cb(undefined, true);
    },
});

// Upload avatar (upload profile picture)
router.post(
    "/users/me/avatar",
    auth,
    upload.single("avatar"),
    async (req, res) => {
        const buffer = await sharp(req.file.buffer)
            .resize({ width: 250, height: 250 })
            .png()
            .toBuffer();
        req.user.avatar = buffer;
        await req.user.save();
        res.send();
    },
    (error, req, res, next) => {
        res.status(400).send({ error: error.message });
    }
);

// Read user (Read profile)
router.get("/users/me", auth, async (req, res) => {
    res.send(req.user);
});

// Read another user (Read profile)
router.get("/users/:id", auth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            throw new Error("User does not exist");
        }

        res.send(user);
    } catch (e) {
        res.status(404).send(e.message);
    }
});

// Read avatar (Read profile picture)
router.get("/users/:id/avatar", async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user || !user.avatar) {
            throw new Error(
                "Either user or the profile picture does not exist"
            );
        }

        res.set("Content-Type", "image/png");
        res.send(user.avatar);
    } catch (e) {
        res.status(404).send(e.message);
    }
});

// Update user (Update profile)
router.patch("/users/me", auth, async (req, res) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = ["firstName", "lastName", "password", "gender"];
    const isValidOperation = updates.every((update) =>
        allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
        return res.status(400).send({ error: "Invalid update." });
    }

    try {
        updates.forEach((update) => {
            req.user[update] = req.body[update];
        });
        await req.user.save();
        res.send(req.user);
    } catch (e) {
        res.status(400).send(e.message);
    }
});

// Delete user (Delete account)
router.delete("/users/me", auth, async (req, res) => {
    try {
        await req.user.deleteOne();
        // sendCancelationEmail(req.user.email, req.user.firstName);
        res.send(req.user);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// Delete avatar (Delete profile picture)
router.delete("/users/me/avatar", auth, async (req, res) => {
    req.user.avatar = undefined;
    await req.user.save();
    res.send();
});

module.exports = router;
