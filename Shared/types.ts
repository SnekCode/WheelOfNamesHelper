export type WheelUsers = {
  [key: string]: WheelUser 
};

export type WheelUser = {
    value: boolean;
    chances: number;
    claimedHere: boolean;
  };
