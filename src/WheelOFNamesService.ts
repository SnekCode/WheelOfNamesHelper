

import { StoreKeys } from "~/Shared/store";

const { store } = window;

interface WheelConfig {
    displayWinnerDialog?: boolean;
    slowSpin?: boolean;
    pageBackgroundColor?: string;
    description: string; // required
    animateWinner?: boolean;
    winnerMessage?: string;
    title: string; // required
    type?: string;
    autoRemoveWinner?: boolean;
    path?: string;
    customPictureName?: string;
    customCoverImageDataUri?: string;
    playClickWhenWinnerRemoved?: boolean;
    duringSpinSound?: string;
    maxNames?: number;
    centerText?: string;
    afterSpinSoundVolume?: number;
    spinTime?: number;
    hubSize?: string;
    coverImageName?: string;
    entries: Entry[]; // required
    isAdvanced?: boolean;
    galleryPicture?: string;
    customPictureDataUri?: string;
    showTitle?: boolean;
    displayHideButton?: boolean;
    afterSpinSound?: string;
    colorSettings?: ColorSetting[];
    duringSpinSoundVolume?: number;
    displayRemoveButton?: boolean;
    pictureType?: string;
    allowDuplicates?: boolean;
    coverImageType?: string;
    drawOutlines?: boolean;
    launchConfetti?: boolean;
    drawShadow?: boolean;
}

interface Entry {
    text: string;
    image: string;
    color?: string;
    weight: number;
    id?: string;
    enabled: boolean;
}

interface ColorSetting {
    color: string;
    enabled: boolean;
}

type WheelPostObject = {
    config: WheelConfig;
};

// Create or Update a Private Wheel with title
// https://wheelofnames.com/api/v1/wheels/shared
export const createOrUpdateSharedWheel = async (title = "The Wheel Of Names Helper") => {
  const apiKey = await store.getStore(StoreKeys.wheelOfNamesApiKey);
  console.log("API KEY", apiKey);

  if (!apiKey) {
    throw new Error("No Wheel of Names API key found");
  }

  const postObject: WheelPostObject = {
    config: {
      description: "Wheel created via API",
      title,
      isAdvanced: true,
      entries: [
        {
          text: "string",
          image: "",
          weight: 1,
          enabled: true,
        },
        {
          text: "test",
          image: "",
          weight: 20,
          enabled: true,
        },
      ],
    },
  };

  const body = JSON.stringify(postObject);

  console.log("BODY", body);
  
  try{
  const response = await fetch(
    "https://wheelofnames.com/api/wheels/private",
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": `${apiKey}`,
      },
      body,
    }
  );
} catch (error) {
    console.log("ERROR", error);
}

};

// get a private wheel based on title
// https://wheelofnames.com/api/v1/wheels/private