// src/twitchService.ts
import axios from 'axios';
import FormData from "form-data";

const CLIENT_ID = "a0jvh4wodyncqkb683vzq4sb2plcpo";
const DEVICE_CODE_URL = 'https://id.twitch.tv/oauth2/device';
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';

export async function getDeviceCode(scopes: string) {
  const response = await axios.post(DEVICE_CODE_URL, new URLSearchParams({
    client_id: CLIENT_ID,
    scope: scopes,
  }), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  return response.data;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function pollForToken(deviceCode: string) {
  const formData = new FormData();
  formData.append("client_id", CLIENT_ID);
  formData.append("scope", "channel:manage:broadcast");
  formData.append("device_code", deviceCode);
  formData.append("grant_type", "urn:ietf:params:oauth:grant-type:device_code");

  while (true) {
    try {
      const response = await axios.post(TOKEN_URL, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.access_token) {
        return response.data;
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response && error.response.status === 400) {
        // Authorization pending, continue polling
        await delay(5000); // Wait for 5 seconds before retrying
      } else {
        throw error;
      }
    }
  }
}