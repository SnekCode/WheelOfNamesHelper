import {Client, Collection, GatewayIntentBits, Guild, User} from "discord.js"
import dotenv from 'dotenv';
import { discordAuthProvider } from "../main/main";
dotenv.config();

// replace with api call later
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

const targetGuild = process.env.TARGET_GUILD;

console.log("DISCORD_TOKEN", DISCORD_TOKEN);

export const setUpClient = () => {
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, "GuildMessageTyping"] });
let userOwnedGuilds: Collection<string, Guild> | undefined;
client.login(DISCORD_TOKEN);

client.once('ready', () => {
    console.log('DISCORD Bot is ready');
    // console.log(client.guilds.cache);

    // get the logged in user's guilds
    const user = discordAuthProvider.user as User | null;
    if (!user) {
        return;
    }
    // console.log("user", user);
    // user id is the owner id of the guild
    userOwnedGuilds = client.guilds.cache.filter((guild) => guild.ownerId === user.id);
    console.log('userOwnedGuilds', userOwnedGuilds);
    
    // client.on('messageCreate', async (message) => {
    //     // check owned guilds
    //     if (!userOwnedGuilds?.some((guild) => guild.id === message.guild?.id)) {
    //         console.log('Not Owned Guild');
    //         return;
    //     }

    //     if (message.content === '!ping') {
    //         message.reply('Pong!');
    //     }
    // });
});

}
