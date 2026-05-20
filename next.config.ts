import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Next.js caps Server Action request bodies at 1 MB by default.
      // uploadListingPhotoAs accepts files up to 8 MB (MAX_PHOTO_BYTES),
      // but anything over 1 MB was rejected by the framework BEFORE the
      // action ran — surfacing as the opaque "An unexpected response was
      // received from the server" error in the photo-upload dialog
      // (2026-05-19 client feedback). 12 MB gives headroom over the 8 MB
      // file cap for multipart-encoding overhead.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
