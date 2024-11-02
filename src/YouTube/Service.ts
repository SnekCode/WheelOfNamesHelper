import axios from "axios";

/** Options for get_live_chat */
export interface FetchOptions {
  apiKey: string;
  clientVersion: string;
  continuation: string;
}
const handle = "@TypicalGamer";
const handleUrl = `https://www.youtube.com/${handle}/live`;

export async function fetchLivePage(
  id: { channelId: string } | { liveId: string } | { handle: string }
) {
  const res = await axios.get(handleUrl);
  return getOptionsFromLivePage(res.data.toString());
}

export function getOptionsFromLivePage(
  data: string
): FetchOptions & { liveId: string } {
  let liveId: string;
  const idResult = data.match(
    /<link rel="canonical" href="https:\/\/www.youtube.com\/watch\?v=(.+?)">/
  );
  if (idResult) {
    liveId = idResult[1];
  } else {
    throw new Error("Live Stream was not found");
  }

  const replayResult = data.match(/['"]isReplay['"]:\s*(true)/);
  if (replayResult) {
    throw new Error(`${liveId} is finished live`);
  }

  let apiKey: string;
  const keyResult = data.match(/['"]INNERTUBE_API_KEY['"]:\s*['"](.+?)['"]/);
  if (keyResult) {
    apiKey = keyResult[1];
  } else {
    throw new Error("API Key was not found");
  }

  let clientVersion: string;
  const verResult = data.match(/['"]clientVersion['"]:\s*['"]([\d.]+?)['"]/);
  if (verResult) {
    clientVersion = verResult[1];
  } else {
    throw new Error("Client Version was not found");
  }

  let continuation: string;
  const continuationResult = data.match(
    /['"]continuation['"]:\s*['"](.+?)['"]/
  );
  if (continuationResult) {
    continuation = continuationResult[1];
  } else {
    throw new Error("Continuation was not found");
  }

  return {
    liveId,
    apiKey,
    clientVersion,
    continuation,
  };
}
