require('dotenv').config();
const { REST, Routes } = require('discord.js');

require('dotenv').config();
const { SlashCommandBuilder } = require('discord.js');

const follow = new SlashCommandBuilder()
    .setName('follow')
    .setDescription('Follow a GitHub repository for new releases')
    .addStringOption(option =>
        option.setName('owner')
            .setDescription('owner of the repository')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('repo')
            .setDescription('Name of the repository')
            .setRequired(true));


const unfollow = new SlashCommandBuilder()
    .setName('unfollow')
    .setDescription('Unfollow a GitHub repository for new releases')
    .addStringOption(option =>
        option.setName('owner')
            .setDescription('The input to echo back')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('repo')
            .setDescription('The input to echo back')
            .setRequired(true));

const list = new SlashCommandBuilder()
    .setName('list')
    .setDescription('List all followed GitHub repositories');

const commands = [
    follow.toJSON(),
    unfollow.toJSON(),
    list.toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.TokenBot);

async function RegisterCommand() {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(process.env.ClientId, process.env.GuildId),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
};

module.exports = RegisterCommand;