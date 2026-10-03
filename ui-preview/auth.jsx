import React, { useSyncExternalStore } from 'react';
import { Link } from '@tanstack/react-router';
const host = { id: 'preview-host', displayName: '示例发起人', isDevFallback: true };
let user = null;
const listeners = new Set();
export const currentPreviewUser = () => user;
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export function setPreviewHost(enabled) { user = enabled ? host : null; listeners.forEach(fn => fn()); }
export const useCurrentUserState = () => ({ user: useSyncExternalStore(subscribe, currentPreviewUser, currentPreviewUser), isPending: false });
export const useCurrentUser = () => useCurrentUserState().user;
export const signOut = async () => setPreviewHost(false);
export const RedirectToSignIn = () => <p>先选择示例身份，即可体验完整管理功能。<Link to="/login">选择身份 ↗</Link></p>;
