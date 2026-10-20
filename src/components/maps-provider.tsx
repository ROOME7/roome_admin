"use client";

import { APIProvider } from "@vis.gl/react-google-maps";
import { GOOGLE_MAPS_KEY } from "@/lib/google-maps";
import { useT } from "@/i18n/client";

/**
 * Loads the Maps JavaScript API once per page. Without a key it says so in
 * place of the map rather than rendering a grey box: a missing
 * NEXT_PUBLIC_GOOGLE_MAPS_API_KEY on the host is the one failure this screen
 * can have that no admin can fix from inside it.
 */
export function MapsProvider({ children }: { children: React.ReactNode }) {
  const t = useT();
  if (!GOOGLE_MAPS_KEY) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-secondary px-6 text-center text-sm text-muted-foreground">
        {t("dashboard.mapNoKey")}
      </div>
    );
  }
  return (
    <APIProvider apiKey={GOOGLE_MAPS_KEY} region="IT" language="it">
      {children}
    </APIProvider>
  );
}
