// The app configuration as the API serves it (`/admin/config/versions`).
// Shared by the server page, the form and the history list.

export interface PlatformGate {
  latestVersion: string;
  latestBuild: number;
  minVersion: string;
  minBuild: number;
  updateMessage: string | null;
  storeUrl: string | null;
}

export interface AppConfig {
  ios: PlatformGate;
  android: PlatformGate;
  maintenance: { enabled: boolean; message: string | null };
}

export interface ConfigVersion {
  version: number;
  live: boolean;
  createdAt: string;
  createdBy: { id: string; name: string | null } | null;
  note: string | null;
  restoredFrom: number | null;
  changed: string[];
  forcedUpdate: boolean;
  config: AppConfig;
}
