import React, { useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { session, login, logout } from "./api";
let state = { user: null, isPending: true };
const listeners = new Set();
const emit = (user, isPending = false) => {
  state = { user, isPending };
  listeners.forEach((fn) => fn());
};
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
session()
  .then((user) => emit(user))
  .catch(() => emit(null));
export const useCurrentUserState = () =>
  useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
export const useCurrentUser = () => useCurrentUserState().user;
export const signIn = async (password) => {
  const user = await login({ data: { password } });
  emit(user);
};
export const signOut = async () => {
  await logout();
  emit(null);
};
export const RedirectToSignIn = () => <Link to="/login">管理员登录</Link>;
