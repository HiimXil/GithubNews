require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const EventEmitter = require('events');
const RegisterCommand = require('./register-commands');

function connectDatabase() {
    const db = new sqlite3.Database('./db/database.db', (err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Connected to the database.');
    });
    return db;
};

function createDatabase() {
    const db = connectDatabase();

    db.run(`CREATE TABLE IF NOT EXISTS followedRepo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner TEXT NOT NULL,
        repo TEXT NOT NULL,
        channel TEXT NOT NULL,
        latest_id INTEGER
    )`);

    return db;
}
async function connectDiscord() {
    const { Client, IntentsBitField } = require('discord.js');
    const client = new Client({
        intents: [
            IntentsBitField.Flags.Guilds,
            IntentsBitField.Flags.GuildMembers,
            IntentsBitField.Flags.GuildMessages,
            IntentsBitField.Flags.MessageContent
        ],
    });
    try {
        await client.login(process.env.TokenBot);
        console.log(`Logged in as ${client.user.tag}!`);
        return client;
    } catch (error) {
        console.log("There was some error when logging into Discord. See below.");
        console.dir(error);
    }
    return null;

}

function closeDatabase(db) {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Close the database connection.');
    });
}

class GitHubReleaseEventStream extends EventEmitter {
    constructor(owner, repo, id) {
        super();
        this.owner = owner;
        this.repo = repo;
        this.lastEventId = id;
    }

    async start() {
        while (true) {
            const response = await axios.get(`https://api.github.com/repos/${this.owner}/${this.repo}/releases/latest`, {
                headers: {
                    Authorization: 'Bearer ' + process.env.GitHubToken
                }
            });
            const eventData = response.data;
            eventData.id = eventData.id.toString();
            if (eventData.id != this.lastEventId) {
                this.emit('release', eventData);
                this.lastEventId = eventData.id;
                const db = connectDatabase();
                db.run(`UPDATE followedRepo SET latest_id = ? WHERE owner = ? AND repo = ?`, [eventData.id, this.owner, this.repo], function (err) {
                    if (err) {
                        return console.error(err.message);
                    }
                    console.log(`Row(s) updated: ${this.changes}`);
                });
                closeDatabase(db);
            }
            await new Promise(resolve => setTimeout(resolve, 60000)); // wait for 60 seconds
        }
    }
}

async function isRepoValid(owner, repo) {
    try {
        const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: {
                Authorization: 'Bearer ' + process.env.GitHubToken
            }
        });
        return true;
    } catch (error) {
        console.log("There was some error when logging into GitHub. See below.");
        return false;
    }

}

async function createGitHubReleaseEventStream(owner, repo, id, channelid, client) {
    const validRepo = await isRepoValid(owner, repo);
    if (!validRepo) {
        message = 'Invalid repo: ' + owner + '/' + repo;
        console.log(message);
        return false;
    }
    const stream = new GitHubReleaseEventStream(owner, repo, id);
    stream.on('release', async event => {
        const channel = await client.channels.fetch(channelid);
        const message = '# ' + repo + '\n ## ' + event.name + '\n [Go to the repo -->](' + event.html_url + ')';
        channel.send({ content: message });
    });
    stream.start();
    return true;
}

async function main() {
    const db = createDatabase();
    const client = await connectDiscord();
    await RegisterCommand();
    sql = `SELECT * FROM followedRepo`;
    db.each(sql, [], async (err, row) => {
        if (err) {
            throw err;
        }
        await createGitHubReleaseEventStream(row.owner, row.repo, row.latest_id, row.channel, client);
    });


    client.on('interactionCreate', async interaction => {

        if (!interaction.isCommand()) return;
        const { commandName, options } = interaction;


        const database = connectDatabase();
        if (commandName === 'follow') {
            const owner = options.getString('owner');
            const repo = options.getString('repo');
            const channel = interaction.channelId;
            if (await createGitHubReleaseEventStream(owner, repo, null, channel, client)) {
                await interaction.reply({ content: 'Followed the repository: ' + owner + '/' + repo + '', ephemeral: true });
                const sql = `INSERT INTO followedRepo (owner, repo, channel) VALUES (?, ?, ?)`;
                database.run(sql, [owner, repo, channel], function (err) {
                    if (err) {
                        return console.error(err.message);
                    }
                    console.log(`A row has been inserted with rowid ${this.lastID}`);
                });
            }
            else {
                await interaction.reply({ content: 'Invalid repository: ' + owner + '/' + repo + '', ephemeral: true });
            }



        } else if (commandName === 'unfollow') {
            const owner = options.getString('owner');
            const repo = options.getString('repo');
            const sql = `DELETE FROM followedRepo WHERE owner = ? AND repo = ?`;
            const database = connectDatabase();
            database.run(sql, [owner, repo], function (err) {
                if (err) {
                    return console.error(err.message);
                }
                console.log(`Row(s) deleted ${this.changes}`);
            });
            await interaction.reply({ content: 'Unfollowed the repository: ' + owner + '/' + repo + '', ephemeral: true });

        } else if (commandName === 'list') {
            const sql = `SELECT * FROM followedRepo`;
            const database = connectDatabase();
            database.all(sql, [], (err, rows) => {
                if (err) {
                    throw err;
                }
                let message = 'Followed repositories:\n';
                rows.forEach((row) => {
                    message += row.owner + '/' + row.repo + '\n';
                });
                interaction.reply({ content: message, ephemeral: true });
            });
        }
        closeDatabase(database);
    });


    closeDatabase(db);


}

main();