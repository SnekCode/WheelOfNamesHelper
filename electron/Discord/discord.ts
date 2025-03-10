import {Client, Collection, Events, GatewayIntentBits, Guild, User} from "discord.js"
import dotenv from 'dotenv';
import { discordAuthProvider } from "../main/main";
dotenv.config();

const targetGuild = process.env.TARGET_GUILD;

export const setUpClient = () => {
const client = new Client({ intents: [GatewayIntentBits.Guilds, "GuildMembers", "GuildPresences", "GuildVoiceStates", "Guilds", GatewayIntentBits.GuildMessages, "GuildMessageTyping"] });
let userOwnedGuilds: Collection<string, Guild> | undefined;
client.login(discordAuthProvider.botToken ?? "");

client.once(Events.ClientReady, readyClient => {
    console.log('DISCORD Bot is ready');
    // console.log(client.guilds.cache);

    // get the logged in user's guilds
    const user = discordAuthProvider.user as User | null;
    if (!user) {
        return;
    }
    // console.log("user", user);
    // user id is the owner id of the guild
    readyClient.guilds.cache.forEach(guild => {
        if (guild.ownerId === user.id) {
            console.log('Owned Guild', guild.name);
        }
    });

    userOwnedGuilds = readyClient.guilds.cache.filter((guild) => guild.ownerId === user.id);
    console.log('userOwnedGuilds', userOwnedGuilds.size);

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
