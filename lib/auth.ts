import { ConfidentialClientApplication } from "@azure/msal-node";

const clientId = process.env.MICROSOFT_CLIENT_ID;
const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
const redirectUri = process.env.MICROSOFT_REDIRECT_URI;

if (!clientId || !clientSecret || !redirectUri) {
  throw new Error("Faltan variables de entorno de Microsoft en .env.local");
}

export const msalConfig = {
  auth: {
    clientId,
    authority: "https://login.microsoftonline.com/consumers",
    clientSecret,
  },
};

export const msalInstance = new ConfidentialClientApplication(msalConfig);

export const graphScopes = [
  "openid",
  "profile",
  "offline_access",
  "User.Read",
  "Files.ReadWrite",
  "Files.ReadWrite.All",
];

export const microsoftRedirectUri = redirectUri;