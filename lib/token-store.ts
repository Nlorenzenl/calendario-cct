import fs from "fs";
import path from "path";

export type TokenStoreData = {
  accessToken: string;
  username: string;
  savedAt: string;
};

const tokenFilePath = path.join(process.cwd(), "data", "token-store.json");

export function saveTokenStore(data: TokenStoreData) {
  fs.writeFileSync(tokenFilePath, JSON.stringify(data, null, 2), "utf8");
}

export function readTokenStore(): TokenStoreData | null {
  try {
    if (!fs.existsSync(tokenFilePath)) {
      return null;
    }

    const raw = fs.readFileSync(tokenFilePath, "utf8");
    const parsed = JSON.parse(raw);

    return {
      accessToken: parsed.accessToken || "",
      username: parsed.username || "",
      savedAt: parsed.savedAt || "",
    };
  } catch (error) {
    console.error("Error leyendo token-store.json:", error);
    return null;
  }
}

export function clearTokenStore() {
  saveTokenStore({
    accessToken: "",
    username: "",
    savedAt: "",
  });
}