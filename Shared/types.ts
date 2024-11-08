// Old state types
export type WheelUsers = {
  [key: string]: WheelUser 
};

export type WheelUser = {
    value: boolean;
    chances: number;
    claimedHere: boolean;
  };

    export interface Entry {
      text: string;
      image?: string;
      color?: string;
      weight: number;
      id?: string;
      enabled?: boolean;
      claimedHere: boolean;
    }

// New state types
  export interface WheelConfig {
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

  export interface ColorSetting {
    color: string;
    enabled: boolean;
  }