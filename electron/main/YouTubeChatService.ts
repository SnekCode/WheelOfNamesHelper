import { LiveChat } from "youtube-chat";

// channelId UCvqRdlKsE5Q8mf8YXbdIJLw
// live id jWjrdz-lLdU

export const connectToYouTubeChat = () => {
  const liveChat = new LiveChat({ channelId: "UCvqRdlKsE5Q8mf8YXbdIJLw" });

  liveChat.on("chat", (chatItem) => {
    console.log(chatItem);
  });
};
