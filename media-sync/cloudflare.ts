import "dotenv/config";

import { openAsBlob } from "node:fs";
import { basename, resolve } from "node:path";

import { type MediaType } from "./schema";

interface CFImageUploadResponse {
  result: {
    id: string;
  };
  success: boolean;
  errors: unknown[];
}

interface CFVideoUploadResponse {
  result: {
    uid: string;
  };
  success: boolean;
  errors: unknown[];
}

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_MEDIA_API_TOKEN;
if (!API_TOKEN || !ACCOUNT_ID) {
  throw new Error(
    "Cloudflare API Token or Account ID are not defined in .env file.",
  );
}

export const uploadMedia = async (
  filePath: string,
  mediaType: MediaType,
): Promise<{ id: string }> => {
  const absolutePath = resolve(filePath);
  let uploadResult: { id: string };

  if (mediaType === "image") {
    uploadResult = await uploadImage(absolutePath);
  } else if (mediaType === "video") {
    uploadResult = await uploadVideo(absolutePath);
  } else {
    throw new Error(
      `Unsupported media type provided to uploadMedia: ${mediaType}`,
    );
  }
  return uploadResult;
};

const uploadImage = async (filePath: string) => {
  const fileBlob = await openAsBlob(filePath, {});
  const formData = new FormData();
  formData.append("file", fileBlob, basename(filePath).replace(" ", "_"));

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/images/v1`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: formData,
      },
    );

    const jsonResponse = (await response.json()) as CFImageUploadResponse;

    return { id: jsonResponse.result.id };
  } catch (error) {
    throw new Error(`Upload for ${filePath} failed.\nDetails:${error}`);
  }
};

const uploadVideo = async (filePath: string) => {
  const fileBlob = await openAsBlob(filePath, {});
  const formData = new FormData();
  formData.append("file", fileBlob, basename(filePath).replace(" ", "_"));
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: formData,
      },
    );

    const jsonResponse = (await response.json()) as CFVideoUploadResponse;

    return { id: jsonResponse.result.uid };
  } catch (error) {
    throw new Error(`Upload for ${filePath} failed.\nDetails:${error}`);
  }
};
