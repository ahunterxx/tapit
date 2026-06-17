import { google } from "googleapis";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

const WALLET_API = "https://walletobjects.googleapis.com/walletobjects/v1";
const DEFAULT_LOGO_URL = "https://placehold.co/200x200/0a0a0a/ffffff.png";

interface ServiceAccountCreds {
  client_email: string;
  private_key: string;
  [key: string]: unknown;
}

function readCreds(): ServiceAccountCreds {
  // Prefer env var JSON (Railway/production) over file path (local dev)
  const credsJson = process.env.GOOGLE_WALLET_CREDENTIALS_JSON;
  if (credsJson) {
    return JSON.parse(credsJson) as ServiceAccountCreds;
  }
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) throw new Error("No Google credentials configured");
  return JSON.parse(fs.readFileSync(path.resolve(credPath), "utf-8")) as ServiceAccountCreds;
}

function getAuth() {
  const credsJson = process.env.GOOGLE_WALLET_CREDENTIALS_JSON;
  if (credsJson) {
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(credsJson) as ServiceAccountCreds,
      scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
    });
  }
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) throw new Error("No Google credentials configured");
  return new google.auth.GoogleAuth({
    keyFile: path.resolve(credPath),
    scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
  });
}

async function getBearerToken(): Promise<string> {
  const auth = getAuth();
  const client = await auth.getClient();
  const tokenRes = await client.getAccessToken();
  if (!tokenRes.token) throw new Error("Failed to get Google auth token");
  return tokenRes.token;
}

function getIssuerId(): string {
  const id = process.env.GOOGLE_WALLET_ISSUER_ID;
  if (!id) throw new Error("GOOGLE_WALLET_ISSUER_ID not set");
  return id;
}

export function getLoyaltyClassId(businessSlug: string): string {
  return `${getIssuerId()}.${businessSlug}`;
}

export function getLoyaltyObjectId(businessSlug: string, clientId: string): string {
  return `${getIssuerId()}.${businessSlug}_${clientId}`;
}

export async function createOrUpdateLoyaltyClass(params: {
  businessSlug: string;
  businessName: string;
  rewardDescription: string;
  logoUrl?: string;
  backgroundColor: string;
}): Promise<void> {
  const token = await getBearerToken();
  const classId = getLoyaltyClassId(params.businessSlug);

  const loyaltyClass = {
    id: classId,
    issuerName: "Tap It",
    programName: params.businessName,
    programLogo: {
      sourceUri: { uri: params.logoUrl ?? DEFAULT_LOGO_URL },
      contentDescription: {
        defaultValue: { language: "en-US", value: `${params.businessName} logo` },
      },
    },
    rewardsTier: "Member",
    rewardsTierLabel: "Status",
    loyaltyPoints: {
      label: "Stamps",
      balance: { int: 0 },
    },
    reviewStatus: "UNDER_REVIEW",
    hexBackgroundColor: params.backgroundColor,
    multipleDevicesAndHoldersAllowedStatus: "ONE_USER_ALL_DEVICES",
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const checkRes = await fetch(`${WALLET_API}/loyaltyClass/${encodeURIComponent(classId)}`, {
    headers,
  });

  if (checkRes.ok) {
    await fetch(`${WALLET_API}/loyaltyClass/${encodeURIComponent(classId)}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(loyaltyClass),
    });
  } else {
    const createRes = await fetch(`${WALLET_API}/loyaltyClass`, {
      method: "POST",
      headers,
      body: JSON.stringify(loyaltyClass),
    });
    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Failed to create LoyaltyClass: ${err}`);
    }
  }
}

export async function createLoyaltyObject(params: {
  businessSlug: string;
  businessName: string;
  clientId: string;
  clientName: string;
  stampsCount: number;
  goalValue: number;
  rewardDescription: string;
  enrolledAt: Date;
}): Promise<string> {
  const token = await getBearerToken();
  const classId = getLoyaltyClassId(params.businessSlug);
  const objectId = getLoyaltyObjectId(params.businessSlug, params.clientId);

  const loyaltyObject = {
    id: objectId,
    classId,
    state: "ACTIVE",
    accountId: params.clientId,
    accountName: params.clientName,
    loyaltyPoints: {
      label: "Stamps",
      balance: { string: `${params.stampsCount} / ${params.goalValue}` },
    },
    textModulesData: [
      { header: "REWARD", body: params.rewardDescription, id: "reward" },
      { header: "MEMBER SINCE", body: params.enrolledAt.toLocaleDateString("en-EG"), id: "since" },
    ],
    barcode: {
      type: "QR_CODE",
      value: objectId,
      alternateText: params.clientId,
    },
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const res = await fetch(`${WALLET_API}/loyaltyObject`, {
    method: "POST",
    headers,
    body: JSON.stringify(loyaltyObject),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create LoyaltyObject: ${err}`);
  }

  return objectId;
}

export async function updateLoyaltyObject(params: {
  objectId: string;
  stampsCount: number;
  goalValue: number;
  rewardDescription: string;
  clientName: string;
}): Promise<void> {
  const token = await getBearerToken();

  const patch = {
    loyaltyPoints: {
      label: "Stamps",
      balance: { string: `${params.stampsCount} / ${params.goalValue}` },
    },
    textModulesData: [
      { header: "REWARD", body: params.rewardDescription, id: "reward" },
    ],
  };

  const res = await fetch(
    `${WALLET_API}/loyaltyObject/${encodeURIComponent(params.objectId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("[GoogleWallet] updateLoyaltyObject failed:", err);
  }
}

export function generateGoogleWalletJwt(params: {
  businessSlug: string;
  clientId: string;
}): string {
  const creds = readCreds();
  const objectId = getLoyaltyObjectId(params.businessSlug, params.clientId);

  const payload = {
    iss: creds.client_email,
    aud: "google",
    origins: [] as string[], // empty = allow saving from any origin/device
    typ: "savetowallet",
    payload: {
      loyaltyObjects: [{ id: objectId }],
    },
  };

  return jwt.sign(payload, creds.private_key, {
    algorithm: "RS256",
    expiresIn: "1h",
  });
}

export function buildGoogleWalletLink(jwtToken: string): string {
  return `https://pay.google.com/gp/v/save/${jwtToken}`;
}

export function isGoogleWalletConfigured(): boolean {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  if (!issuerId) return false;
  if (process.env.GOOGLE_WALLET_CREDENTIALS_JSON) return true;
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) return false;
  try {
    fs.accessSync(path.resolve(credPath));
    return true;
  } catch {
    return false;
  }
}
