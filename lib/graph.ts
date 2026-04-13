import { Client } from "@microsoft/microsoft-graph-client";

export function getGraphClient(accessToken: string) {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

export function encodeSharingUrl(sharingUrl: string) {
  const base64Value = Buffer.from(sharingUrl, "utf8").toString("base64");
  return `u!${base64Value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
}