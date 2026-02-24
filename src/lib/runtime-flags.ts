export const isAuthBypassEnabled =
  process.env.NODE_ENV !== "production" &&
  process.env.PMIS_REQUIRE_LOGIN !== "true";
