import fs from "fs";
import path from "path";

type OpatSessionStore = {
  cookie: string;
};

const sessionFilePath = path.join(process.cwd(), "data", "opat-session.json");

export function readOpatSession(): OpatSessionStore | null {
  const envCookie = String(process.env.OPAT_COOKIE || "").trim();
  if (envCookie) {
    return { cookie: envCookie };
  }

  try {
    if (!fs.existsSync(sessionFilePath)) {
      return null;
    }

    const raw = fs.readFileSync(sessionFilePath, "utf8");
    const parsed = JSON.parse(raw);

    return {
      cookie: String(parsed?.cookie || "").trim(),
    };
  } catch (error) {
    console.error("Error leyendo opat-session.json:", error);
    return null;
  }
}

export function getOpatCookieOrThrow() {
  const session = readOpatSession();

  if (!session || !session.cookie) {
    throw new Error(
      "No existe una cookie OPAT válida. Define OPAT_COOKIE o data/opat-session.json"
    );
  }

  return session.cookie;
}