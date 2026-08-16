/* =========================================================
   ATLAS — shared auth helper
   One Supabase client for auth, reused (via persisted session
   in localStorage) by every page's own Supabase client too —
   supabase-js stores the session under the same key for a given
   project, so signing in once here keeps you signed in across
   the dashboard, Ask Atlas, and Budget Tracker automatically.

   Include this + the supabase-js CDN script on every page,
   before dashboard.js / atlas.js / widgets.js / script.js.
========================================================= */

const ATLAS_AUTH_URL = "https://wmedotwgqrsgrhjdzbbn.supabase.co";
const ATLAS_AUTH_KEY = "sb_publishable_6NI-3Sg2gv0NSEm7mBddHw_kNi2sg-f";

let atlasAuthClient = null;
try {
  atlasAuthClient = window.supabase.createClient(ATLAS_AUTH_URL, ATLAS_AUTH_KEY);
} catch (e) {
  console.error("Atlas auth: could not create Supabase client.", e);
}

async function atlasGetSession() {
  if (!atlasAuthClient) return null;
  const { data } = await atlasAuthClient.auth.getSession();
  return data.session || null;
}

async function atlasSignUp(email, password) {
  return atlasAuthClient.auth.signUp({ email, password });
}

async function atlasSignIn(email, password) {
  return atlasAuthClient.auth.signInWithPassword({ email, password });
}

async function atlasSignOut() {
  await atlasAuthClient.auth.signOut();
  window.location.href = atlasAuthRootPath() + "index.html";
}

// Works out how many folders deep the current page is, so the
// same helper can redirect correctly from /, /dashboard/, /atlas/,
// /tools/budget-tracker/, etc.
function atlasAuthRootPath() {
  const depth = window.location.pathname.replace(/^\/|\/$/g, "").split("/").filter(Boolean).length;
  // if we're already at root (e.g. "/" or "/index.html"), depth via folders is 0
  const path = window.location.pathname.endsWith("/") || window.location.pathname.endsWith(".html")
    ? window.location.pathname
    : window.location.pathname + "/";
  const folders = path.split("/").filter(Boolean);
  const isFile = /\.[a-z]+$/i.test(window.location.pathname);
  const folderDepth = isFile ? folders.length - 1 : folders.length;
  return "../".repeat(folderDepth) || "./";
}

// Call on any page that requires a signed-in user. Redirects to
// the landing page (with a return path) if there's no session.
async function atlasRequireAuth() {
  const session = await atlasGetSession();
  if (!session) {
    const back = encodeURIComponent(window.location.href);
    window.location.href = `${atlasAuthRootPath()}index.html?next=${back}`;
    return null;
  }
  return session;
}