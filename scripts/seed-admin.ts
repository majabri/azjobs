/**
 * Seed an initial admin user.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   ADMIN_EMAIL=admin@example.com \
 *   npm run seed:admin
 *
 * What it does:
 *   1. Creates (or looks up) the user in Supabase Auth with the given email,
 *      email already confirmed, and NO password set.
 *   2. Marks the user metadata with `must_set_password: true` so the app will
 *      redirect them to the set-password screen on first login.
 *   3. Upserts the user's role to "admin" in the `user_roles` table.
 *   4. Sets the profile username to "admin" so the admin can log in with
 *      username "admin" instead of their email address.
 *   5. Generates a one-time magic-link and prints it to the console so the
 *      admin can log in for the first time without a password.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_EMAIL) {
  console.error(
    "Error: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and ADMIN_EMAIL must all be set."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(`\nSeeding admin user: ${ADMIN_EMAIL}\n`);

  // 1. Create user (no password, email confirmed, must_set_password flag)
  const { data: createData, error: createError } =
    await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL!,
      email_confirm: true,
      user_metadata: { must_set_password: true },
    });

  let userId: string;

  if (createError) {
    if (createError.message.includes("already been registered")) {
      // User exists — fetch by email
      const { data: listData, error: listError } =
        await supabase.auth.admin.listUsers();
      if (listError) throw listError;

      const existing = listData.users.find((u) => u.email === ADMIN_EMAIL);
      if (!existing) {
        throw new Error("User reported as existing but could not be found.");
      }

      userId = existing.id;
      console.log(`User already exists (id: ${userId}). Updating metadata…`);

      // Ensure must_set_password is set if they have never set a password yet
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          ...existing.user_metadata,
          must_set_password: true,
        },
      });
    } else {
      throw createError;
    }
  } else {
    userId = createData.user.id;
    console.log(`User created (id: ${userId}).`);
  }

  // 2. Upsert admin role
  const { error: roleError } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id" });

  if (roleError) throw roleError;
  console.log("Role set to admin.");

  // 3. Set username to "admin" in profiles so the admin can log in with username "admin"
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      { user_id: userId, username: "admin", email: ADMIN_EMAIL, full_name: "Admin" },
      { onConflict: "user_id" },
    );

  if (profileError) {
    console.warn("Could not set admin username (profiles table may not exist yet):", profileError.message);
  } else {
    console.log('Profile username set to "admin". Login with username: admin');
  }

  // 4. Generate a magic link for first login
  const { data: linkData, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: ADMIN_EMAIL!,
    });

  if (linkError) throw linkError;

  const loginUrl =
    (linkData as { properties?: { action_link?: string } }).properties
      ?.action_link ?? "(link not available)";

  console.log("\n✅  Admin user ready.");
  console.log('   Login username: admin  (or use email directly)');
  console.log("\n🔗  One-time login link (expires in ~24 hours):");
  console.log(`\n    ${loginUrl}\n`);
  console.log(
    "Share this link with the admin. After clicking it they will be prompted\nto set their password before accessing the control center.\n"
  );
}

main().catch((err) => {
  console.error("\n❌  Seed failed:", err.message ?? err);
  process.exit(1);
});
