/**
 * Apple PassKit service — generates signed .pkpass files.
 * Requires Apple Developer Account + Pass Type Certificate.
 * All functions return null when Apple certs are not configured.
 * Wire in by setting APPLE_TEAM_ID, APPLE_PASS_TYPE_ID, APPLE_CERT_PATH,
 * APPLE_CERT_PASSWORD, and APPLE_WWDR_PATH env vars.
 */

import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export function isAppleConfigured(): boolean {
  return !!(
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_PASS_TYPE_ID &&
    process.env.APPLE_CERT_PATH &&
    process.env.APPLE_CERT_PASSWORD &&
    process.env.APPLE_WWDR_PATH
  );
}

export interface PassParams {
  serialNumber: string;
  authToken: string;
  businessName: string;
  clientName: string;
  stampsCount: number;
  goalValue: number;
  rewardDescription: string;
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
  logoBuffer?: Buffer;
}

export async function generatePass(params: PassParams): Promise<Buffer | null> {
  if (!isAppleConfigured()) {
    console.warn("[PassKit] Apple certs not configured — skipping .pkpass generation");
    return null;
  }

  try {
    // Dynamic import so the module doesn't crash if certs are missing
    const { PKPass } = await import("passkit-generator");

    const certPath = path.resolve(process.env.APPLE_CERT_PATH!);
    const wwdrPath = path.resolve(process.env.APPLE_WWDR_PATH!);

    const pass = new PKPass(
      {},
      {
        signerCert: fs.readFileSync(certPath),
        signerKey: fs.readFileSync(certPath),
        signerKeyPassphrase: process.env.APPLE_CERT_PASSWORD,
        wwdr: fs.readFileSync(wwdrPath),
      },
      {
        formatVersion: 1,
        passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID!,
        serialNumber: params.serialNumber,
        teamIdentifier: process.env.APPLE_TEAM_ID!,
        webServiceURL: `${process.env.BASE_URL}/passes/`,
        authenticationToken: params.authToken,
        organizationName: params.businessName,
        description: "Loyalty Card",
        backgroundColor: params.backgroundColor,
        foregroundColor: params.foregroundColor,
        labelColor: params.labelColor,
      }
    );

    // Set pass type and fields (passkit-generator v3 API)
    pass.type = "storeCard";
    pass.headerFields.push({
      key: "stamps",
      label: "STAMPS",
      value: `${params.stampsCount} / ${params.goalValue}`,
    });
    pass.primaryFields.push({
      key: "reward",
      label: "REWARD",
      value: params.rewardDescription,
    });
    pass.secondaryFields.push({
      key: "name",
      label: "MEMBER",
      value: params.clientName,
    });
    pass.backFields.push({
      key: "terms",
      label: "HOW IT WORKS",
      value: "Show this card at each visit to earn stamps toward your reward.",
    });

    // Add placeholder icon if no logo provided
    const iconBuffer =
      params.logoBuffer ??
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAB4AAAAeCAYAAAA7MK6iAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABZ0RVh0Q3JlYXRpb24gVGltZQAxMC8yOS8xMiKqq3kAAAAcdEVYdFNvZnR3YXJlAEFkb2JlIEZpcmV3b3JrcyBDUzVxteM2AAABHklEQVRIie2WvQ3CMBCFnwMGYAFGgAVgAUZgA0ZgA0ZgA1iAEWABRoAFvAHvkSIFJSGO7XP4pCtFiu+e3+nOjgEAwMw2khZm9gJgZtZJeiYAACJJkjRJkjRJ0iRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJ0iRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJ0iRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJ0iRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJ0iRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJAADgA0V7euvPVlzTAAAAAElFTkSuQmCC",
        "base64"
      );

    pass.addBuffer("icon.png", iconBuffer);
    pass.addBuffer("icon@2x.png", iconBuffer);

    if (params.logoBuffer) {
      pass.addBuffer("logo.png", params.logoBuffer);
      pass.addBuffer("logo@2x.png", params.logoBuffer);
    }

    return pass.getAsBuffer();
  } catch (err) {
    console.error("[PassKit] Error generating pass:", err);
    return null;
  }
}

export function generateAuthToken(): string {
  return uuidv4().replace(/-/g, "");
}
