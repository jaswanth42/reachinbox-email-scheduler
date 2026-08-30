import dotenv from "dotenv";
dotenv.config();

import { Router } from "express";
import bcrypt from "bcryptjs";
import axios from "axios";
import jwt from "jsonwebtoken";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import pool from "../config/database.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import {
  disconnectSlack,
  getSlackConnection,
  saveSlackConnection,
} from "../services/slack.service.js";

const router = Router();

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const SLACK_REDIRECT_URI = process.env.SLACK_REDIRECT_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

function getAuthUserId(req: any): string {
  return req.authUser.userId;
}

/*
 * Slack OAuth
 *
 * User -> Slack authorize -> callback -> token exchange -> DB.
 */
function buildSlackAuthorizationUrl(userId: string) {
  if (!SLACK_CLIENT_ID || !SLACK_REDIRECT_URI) {
    throw new Error("Slack OAuth is not configured");
  }

  const state = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "10m" });
  const params = new URLSearchParams({
    client_id: SLACK_CLIENT_ID,
    scope: "chat:write,channels:read,channels:join",
    redirect_uri: SLACK_REDIRECT_URI,
    state,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

router.get("/slack/connect-url", authMiddleware, (req, res) => {
  try {
    return res.json({
      success: true,
      url: buildSlackAuthorizationUrl(getAuthUserId(req)),
    });
  } catch (error) {
    console.error("Slack connect URL error:", error);
    return res.status(500).json({ success: false, message: "Slack OAuth is not configured" });
  }
});

router.get("/slack/connect", authMiddleware, (req, res) => {
  try {
    return res.redirect(buildSlackAuthorizationUrl(getAuthUserId(req)));
  } catch (error) {
    console.error("Slack connect error:", error);
    return res.status(500).json({ success: false, message: "Slack OAuth is not configured" });
  }
});

router.get("/slack/callback", async (req, res) => {
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");

    if (!code || !state) {
      return res.redirect(`${FRONTEND_URL}/slack/callback?success=false&error=missing_code_or_state`);
    }

    const payload = jwt.verify(state, JWT_SECRET) as { userId: string };

    if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET || !SLACK_REDIRECT_URI) {
      throw new Error("Slack OAuth is not configured");
    }

    const tokenResponse = await axios.post(
      "https://slack.com/api/oauth.v2.access",
      new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code,
        redirect_uri: SLACK_REDIRECT_URI,
      }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    if (!tokenResponse.data?.ok || !tokenResponse.data?.access_token) {
      throw new Error(tokenResponse.data?.error || "Slack OAuth token exchange failed");
    }

    const accessToken = tokenResponse.data.access_token as string;
    const teamId = tokenResponse.data.team?.id as string;
    const teamName = tokenResponse.data.team?.name as string | undefined;
    const botUserId = tokenResponse.data.bot_user_id as string | undefined;

    const channelsResponse = await axios.get(
      "https://slack.com/api/conversations.list",
      {
        params: {
          types: "public_channel,private_channel",
          exclude_archived: true,
          limit: 100,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!channelsResponse.data?.ok) {
      throw new Error(channelsResponse.data?.error || "Unable to read Slack channels");
    }

    const channels = Array.isArray(channelsResponse.data.channels)
      ? channelsResponse.data.channels
      : [];

    // Use an accessible public channel. If the bot is not a member, join it first.
    let channel = channels.find((item: any) => item.is_member && !item.is_archived) || null;

    if (!channel) {
      const publicChannel = channels.find(
        (item: any) => !item.is_private && !item.is_archived
      );

      if (publicChannel?.id) {
        const joinResponse = await axios.post(
          "https://slack.com/api/conversations.join",
          { channel: publicChannel.id },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (joinResponse.data?.ok) {
          channel = publicChannel;
        }
      }
    }

    await saveSlackConnection({
      userId: payload.userId,
      teamId,
      teamName,
      botUserId,
      channelId: channel?.id || null,
      accessToken,
    });

    return res.redirect(
      `${FRONTEND_URL}/slack/callback?success=true&team=${encodeURIComponent(teamName || "Slack")}`
    );
  } catch (error) {
    console.error("Slack OAuth callback error:", error);
    return res.redirect(
      `${FRONTEND_URL}/slack/callback?success=false&error=oauth_failed`
    );
  }
});

router.get("/slack/status", authMiddleware, async (req, res) => {
  try {
    const connection = await getSlackConnection(getAuthUserId(req));
    return res.json({
      success: true,
      connected: Boolean(connection),
      teamName: connection?.slack_team_name || null,
      channelConfigured: Boolean(connection?.slack_channel_id),
    });
  } catch (error) {
    console.error("Slack status error:", error);
    return res.status(500).json({ success: false, message: "Failed to get Slack status" });
  }
});

router.post("/slack/disconnect", authMiddleware, async (req, res) => {
  try {
    await disconnectSlack(getAuthUserId(req));
    return res.json({ success: true, message: "Slack disconnected" });
  } catch (error) {
    console.error("Slack disconnect error:", error);
    return res.status(500).json({ success: false, message: "Failed to disconnect Slack" });
  }
});


/*
 * GET /api/auth/senders
 *
 * Return only sender addresses belonging to the authenticated user.
 */
router.get("/senders", authMiddleware, async (req, res) => {
  try {
    const userId = (
      req as typeof req & {
        authUser: {
          userId: string;
          email: string;
        };
      }
    ).authUser.userId;

    const result = await pool.query(
      `
      SELECT
        id,
        email,
        display_name AS "displayName"
      FROM senders
      WHERE user_id = $1
      ORDER BY created_at ASC
      `,
      [userId]
    );

    return res.json({
      success: true,
      senders: result.rows,
    });
  } catch (error) {
    console.error("Get senders error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch senders",
    });
  }
});

const JWT_SECRET: string = process.env.JWT_SECRET || "";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured");
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL;

if (
  !GOOGLE_CLIENT_ID ||
  !GOOGLE_CLIENT_SECRET ||
  !GOOGLE_CALLBACK_URL
) {
  console.warn(
    "Google OAuth environment variables are not fully configured"
  );
}

/*
 * =========================
 * JWT HELPER
 * =========================
 */

function createToken(user: {
  id: string;
  email: string;
}) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

/*
 * =========================
 * ENSURE SENDER
 * =========================
 *
 * Every user should have a sender record.
 *
 * users.id
 *    ↓
 * senders.user_id
 *    ↓
 * emails.sender_id
 *
 * ON CONFLICT prevents duplicate sender
 * records for the same user + email.
 */

async function ensureSender(
  userId: string,
  email: string,
  displayName?: string | null
) {
  const result = await pool.query(
    `
    INSERT INTO senders (
      user_id,
      email,
      display_name
    )
    VALUES ($1, $2, $3)

    ON CONFLICT (user_id, email)
    DO UPDATE SET
      display_name = COALESCE(
        EXCLUDED.display_name,
        senders.display_name
      )

    RETURNING
      id,
      user_id,
      email,
      display_name
    `,
    [
      userId,
      email.trim().toLowerCase(),
      displayName?.trim() || null,
    ]
  );

  return result.rows[0];
}

/*
 * =========================
 * GOOGLE OAUTH
 * =========================
 */

if (
  GOOGLE_CLIENT_ID &&
  GOOGLE_CLIENT_SECRET &&
  GOOGLE_CALLBACK_URL
) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
      },

      async (
        accessToken,
        refreshToken,
        profile,
        done
      ) => {
        try {
          const googleId = profile.id;

          const email =
            profile.emails?.[0]?.value
              ?.trim()
              .toLowerCase();

          const name =
            profile.displayName ||
            profile.name?.givenName ||
            "Google User";

          const avatarUrl =
            profile.photos?.[0]?.value || null;

          if (!email) {
            return done(
              new Error(
                "Google account does not provide an email address"
              )
            );
          }

          /*
           * =========================
           * 1. CHECK BY GOOGLE ID
           * =========================
           */

          const googleUser = await pool.query(
            `
            SELECT
              id,
              name,
              email,
              google_id,
              avatar_url,
              created_at
            FROM users
            WHERE google_id = $1
            `,
            [googleId]
          );

          if (googleUser.rows.length > 0) {
            const user = googleUser.rows[0];

            /*
             * Make sure sender exists.
             *
             * If it already exists, no duplicate
             * row will be created.
             */
            await ensureSender(
              user.id,
              user.email,
              user.name
            );

            return done(null, user);
          }

          /*
           * =========================
           * 2. CHECK BY EMAIL
           * =========================
           */

          const existingUser = await pool.query(
            `
            SELECT
              id,
              name,
              email,
              google_id,
              avatar_url,
              created_at
            FROM users
            WHERE email = $1
            `,
            [email]
          );

          if (existingUser.rows.length > 0) {
            const user = existingUser.rows[0];

            /*
             * Make sure sender exists.
             */
            await ensureSender(
              user.id,
              user.email,
              user.name
            );

            /*
             * Link Google account
             * to existing account.
             */
            const updatedUser = await pool.query(
              `
              UPDATE users
              SET
                google_id = $1,
                avatar_url = COALESCE(
                  $2,
                  avatar_url
                ),
                updated_at = NOW()
              WHERE id = $3

              RETURNING
                id,
                name,
                email,
                google_id,
                avatar_url,
                created_at
              `,
              [
                googleId,
                avatarUrl,
                user.id,
              ]
            );

            return done(
              null,
              updatedUser.rows[0]
            );
          }

          /*
           * =========================
           * 3. CREATE NEW GOOGLE USER
           * =========================
           */

          const newUser = await pool.query(
            `
            INSERT INTO users (
              google_id,
              name,
              email,
              avatar_url
            )
            VALUES ($1, $2, $3, $4)

            RETURNING
              id,
              name,
              email,
              google_id,
              avatar_url,
              created_at
            `,
            [
              googleId,
              name,
              email,
              avatarUrl,
            ]
          );

          const user = newUser.rows[0];

          /*
           * IMPORTANT:
           *
           * New Google user also gets
           * a sender record automatically.
           */
          await ensureSender(
            user.id,
            user.email,
            user.name
          );

          return done(null, user);
        } catch (error) {
          console.error(
            "Google OAuth error:",
            error
          );

          return done(error as Error);
        }
      }
    )
  );
}

/*
 * =========================
 * GOOGLE LOGIN
 * =========================
 */

router.get(
  "/google",
  (req, res, next) => {
    if (
      !GOOGLE_CLIENT_ID ||
      !GOOGLE_CLIENT_SECRET ||
      !GOOGLE_CALLBACK_URL
    ) {
      return res.status(500).json({
        success: false,
        message:
          "Google OAuth is not configured on the server",
      });
    }

    passport.authenticate("google", {
      scope: ["profile", "email"],
      session: false,
    })(req, res, next);
  }
);


/*
 * =========================
 * GOOGLE CALLBACK
 * =========================
 */

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect:
      "http://localhost:5173/login?error=google_auth_failed",
  }),

  (req, res) => {
    try {
      const user = req.user as {
        id: string;
        name: string;
        email: string;
        avatar_url?: string | null;
        created_at?: string;
      };

      /*
       * Create JWT for the authenticated user.
       */
      const token = createToken({
        id: user.id,
        email: user.email,
      });

      /*
       * Send the user profile to the frontend as well.
       *
       * This is needed because the frontend header displays:
       * - Name
       * - Email
       * - Avatar
       */
      const userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url || null,
        created_at: user.created_at || null,
      };

      const frontendUrl =
        process.env.FRONTEND_URL ||
        "http://localhost:5173";

      /*
       * Redirect to the frontend callback with:
       * - JWT token
       * - User profile
       */
      return res.redirect(
        `${frontendUrl}/auth/callback?token=${encodeURIComponent(
          token
        )}&user=${encodeURIComponent(
          JSON.stringify(userData)
        )}`
      );
    } catch (error) {
      console.error(
        "Google callback error:",
        error
      );

      return res.redirect(
        "http://localhost:5173/login?error=google_auth_failed"
      );
    }
  }
);



/*
 * =========================
 * SIGNUP
 * =========================
 */

router.post(
  "/signup",
  async (req, res) => {
    try {
      const {
        name,
        email,
        password,
      } = req.body;

      /*
       * Validation
       */

      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message:
            "Name, email and password are required",
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 6 characters",
        });
      }

      const normalizedEmail =
        email.trim().toLowerCase();

      /*
       * Check existing user
       */

      const existingUser =
        await pool.query(
          `
          SELECT id
          FROM users
          WHERE email = $1
          `,
          [normalizedEmail]
        );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message:
            "An account with this email already exists",
        });
      }

      /*
       * Hash password
       */

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );

      /*
       * Create user
       */

      const result =
        await pool.query(
          `
          INSERT INTO users (
            name,
            email,
            password_hash
          )
          VALUES ($1, $2, $3)

          RETURNING
            id,
            name,
            email,
            avatar_url,
            created_at
          `,
          [
            name.trim(),
            normalizedEmail,
            passwordHash,
          ]
        );

      const user = result.rows[0];

      /*
       * IMPORTANT:
       *
       * Automatically create sender
       * for the new account.
       */
      await ensureSender(
        user.id,
        user.email,
        user.name
      );

      /*
       * Create JWT
       */

      const token = createToken({
        id: user.id,
        email: user.email,
      });

      return res.status(201).json({
        success: true,
        message:
          "Account created successfully",
        token,
        user,
      });
    } catch (error) {
      console.error(
        "Signup error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to create account",
      });
    }
  }
);

/*
 * =========================
 * LOGIN
 * =========================
 */

router.post(
  "/login",
  async (req, res) => {
    try {
      const {
        email,
        password,
      } = req.body;

      /*
       * Validation
       */

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message:
            "Email and password are required",
        });
      }

      const normalizedEmail =
        email.trim().toLowerCase();

      /*
       * Find user
       */

      const result =
        await pool.query(
          `
          SELECT
            id,
            name,
            email,
            password_hash,
            avatar_url,
            created_at
          FROM users
          WHERE email = $1
          `,
          [normalizedEmail]
        );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message:
            "Invalid email or password",
        });
      }

      const user = result.rows[0];

      /*
       * Google-only account
       */

      if (!user.password_hash) {
        return res.status(401).json({
          success: false,
          message:
            "This account uses Google login. Please continue with Google.",
        });
      }

      /*
       * Verify password
       */

      const passwordMatches =
        await bcrypt.compare(
          password,
          user.password_hash
        );

      if (!passwordMatches) {
        return res.status(401).json({
          success: false,
          message:
            "Invalid email or password",
        });
      }

      /*
       * IMPORTANT:
       *
       * Make sure sender exists.
       *
       * For old users:
       * - creates sender if missing
       *
       * For users who already have sender:
       * - does NOT create duplicate
       */
      await ensureSender(
        user.id,
        user.email,
        user.name
      );

      /*
       * Create JWT
       */

      const token = createToken({
        id: user.id,
        email: user.email,
      });

      const safeUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
      };

      return res.json({
        success: true,
        message: "Login successful",
        token,
        user: safeUser,
      });
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to login",
      });
    }
  }
);

export default router;