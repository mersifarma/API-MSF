import * as Application from 'expo-application';

const FALLBACK_API_URL = 'http://10.0.2.2:8001';

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? FALLBACK_API_URL
).replace(/\/$/, '');

export const APP_VERSION = Application.nativeApplicationVersion ?? '0.0.0';
