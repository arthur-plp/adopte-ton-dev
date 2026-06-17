"use client";

import { createAuthClient } from "better-auth/react";

const client = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "http://localhost:3000",
});

export const signIn = client.signIn;
export const signUp = client.signUp;
export const signOut = client.signOut;
export const useSession = client.useSession;
export const linkSocial = client.linkSocial;
export const unlinkAccount = client.unlinkAccount;
export const requestPasswordReset = client.requestPasswordReset;
export const resetPassword = client.resetPassword;
